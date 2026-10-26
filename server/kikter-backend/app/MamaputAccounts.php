<?php

namespace App;

use App\Models\GameProfile;
use App\Models\MamaputPlayer;
use App\Models\MamaputWalletLog;
use App\Models\User;
use App\Models\VatarPlayer;
use App\Models\VatarPurchase;
use Illuminate\Support\Facades\DB;

/**
 * Sign-in for Mama Put: guests, Kikter accounts (shared with Lagos War) and
 * Lagos Life players. Each person ends up with one player row, so a save
 * made outside Lagos Life and one made inside it stay in sync once linked.
 *
 * The coin wallet is the Kikter coin balance (GameProfile) for account
 * holders and the player row's own wallet for Lagos Life-only players.
 */
final class MamaputAccounts
{
    /**
     * The player for this identity, linking or absorbing the device's
     * current player where that is safe.
     */
    public static function signIn(?MamaputPlayer $current, ?User $user, ?VatarPlayer $vatar): MamaputPlayer
    {
        return DB::transaction(function () use ($current, $user, $vatar): MamaputPlayer {
            $target = $user
                ? MamaputPlayer::where('user_id', $user->id)->first()
                : MamaputPlayer::where('vatar_player_id', $vatar->id)->first();
            $current = $current?->fresh();

            if (! $target) {
                // Link this identity to the device's player when it has no
                // identity of the same kind yet (a guest, or the other kind).
                if ($current && ($user ? ! $current->user_id : ! $current->vatar_player_id)) {
                    $target = $current;
                } else {
                    [$target] = MamaputPlayer::issue($user?->name ?? $vatar->name);
                }
            } elseif ($current && $current->id !== $target->id) {
                $guest = ! $current->user_id && ! $current->vatar_player_id;
                $otherKind = $user
                    ? ! $current->user_id && ! $target->vatar_player_id
                    : ! $current->vatar_player_id && ! $target->user_id;
                if ($guest || $otherKind) {
                    // Keep the account holder's row when Lagos Life meets an account.
                    [$keep, $drop] = ! $user && $current->user_id ? [$current, $target] : [$target, $current];
                    self::absorb($drop, $keep);
                    $target = $keep;
                }
            }

            if ($user && ! $target->user_id) {
                $target->user_id = $user->id;
            }
            if ($vatar && ! $target->vatar_player_id) {
                $target->vatar_player_id = $vatar->id;
            }
            // Guests get an automatic "Mama Put 1234" name; signing in gives
            // them the name they registered with or use in Lagos Life.
            if (self::isAutoName($target->name)) {
                $target->name = self::displayName($user?->name ?? $vatar?->name) ?? $target->name;
            }
            $target->last_seen_at = now();
            $target->save();
            if ($target->user_id && $target->wallet > 0) {
                // A Lagos Life wallet joins the Kikter coin balance.
                $amount = (int) $target->wallet;
                $target->update(['wallet' => 0]);
                self::credit($target, $amount, 'linked');
            }

            return $target;
        });
    }

    public static function isAutoName(?string $name): bool
    {
        return (bool) preg_match('/^Mama Put \d{4}$/', (string) $name);
    }

    public static function displayName(?string $name): ?string
    {
        $name = trim((string) preg_replace("/[^\\pL\\pN '&.-]+/u", '', (string) $name));

        return $name !== '' ? mb_substr($name, 0, 30) : null;
    }

    /** Moves one player's shifts, coins and save into another and deletes it. */
    private static function absorb(MamaputPlayer $from, MamaputPlayer $into): void
    {
        $from->shifts()->update(['player_id' => $into->id]);
        $from->walletLogs()->update(['player_id' => $into->id]);
        $into->shifts_played += $from->shifts_played;
        $into->wallet += $from->wallet;
        $vatar = $from->vatar_player_id;
        if (! $into->save && $from->save) {
            $into->syncFromSave($from->save);
        }
        $from->delete();
        if ($vatar && ! $into->vatar_player_id) {
            $into->vatar_player_id = $vatar;
        }
        $into->save();
    }

    /**
     * Delivers a paid Lagos Life coin pack: its coins go to the buyer's
     * wallet once, however often the game, the webhook or a retry asks.
     * Lagos Life is then told the purchase was delivered.
     *
     * @param  array<string, mixed>|null  $remote  the purchase, if already fetched
     * @return array{granted: bool, player: MamaputPlayer, purchase: VatarPurchase}
     */
    public static function deliverPurchase(VatarApi $api, string $purchaseId, ?VatarPlayer $owner = null, ?array $remote = null): array
    {
        $setting = $api->setting();
        $remote ??= $api->call('GET', '/purchases/'.rawurlencode($purchaseId));
        abort_unless(($remote['id'] ?? null) === $purchaseId && ($remote['mode'] ?? null) === $setting->mode, 403, 'Vatar purchase mode or ID mismatch.');
        abort_unless(in_array($remote['status'] ?? null, ['paid', 'delivered', 'refunded'], true), 422, 'Purchase is not paid.');
        $product = MamaputConfig::product((string) ($remote['productId'] ?? ''));
        abort_unless($product && ($product['type'] === 'coins' || $product['type'] === 'cash' || $product['item'] !== ''),
            422, 'This product is not on sale in Mama Put.');
        $coins = $product['type'] === 'coins';
        // Naira is stored in hundreds so large amounts fit the quantity column.
        $quantity = $product['type'] === 'cash' ? intdiv($product['amount'] + 99, 100) : $product['amount'];
        $owner ??= VatarPlayer::where('mode', $setting->mode)->where('player_id', (string) ($remote['playerId'] ?? ''))->first();
        // 503 asks Lagos Life (or the retry queue) to try again later.
        abort_unless($owner, 503, 'Player must open Mama Put before delivery.');
        abort_unless(($remote['playerId'] ?? null) === $owner->player_id && $owner->mode === $setting->mode, 403, 'Purchase belongs to another player.');
        $player = MamaputPlayer::where('vatar_player_id', $owner->id)->first();
        abort_unless($player, 503, 'Player must open Mama Put before delivery.');
        $granted = DB::transaction(function () use ($purchaseId, $owner, $remote, $product, $player, $coins, $quantity): bool {
            $row = VatarPurchase::firstOrCreate(
                ['mode' => $owner->mode, 'game_id' => $owner->game_id, 'purchase_id' => $purchaseId],
                ['vatar_player_id' => $owner->id, 'product_id' => $remote['productId'], 'status' => $remote['status'],
                    'item' => $coins ? 'mamaput_coins' : 'mamaput:'.$product['type'].':'.$product['item'],
                    'quantity' => max(1, min(65000, $quantity))],
            );
            $row = VatarPurchase::whereKey($row->id)->lockForUpdate()->firstOrFail();
            abort_unless($row->vatar_player_id === $owner->id && str_starts_with((string) $row->item, 'mamaput'), 409, 'Purchase identity mismatch.');
            $row->status = $remote['status'];
            $grant = $row->status !== 'refunded' && ! $row->granted_at;
            if ($grant) {
                $row->granted_at = now();
                if ($row->item === 'mamaput_coins') {
                    self::credit($player, $row->quantity, 'lagoslife_purchase', $row->purchase_id);
                    $row->applied_at = now();
                }
            }
            if ($row->status === 'delivered') {
                $row->delivered_at ??= now();
            }
            $row->save();

            return $grant;
        });
        $row = VatarPurchase::where('mode', $owner->mode)->where('game_id', $owner->game_id)
            ->where('purchase_id', $purchaseId)->firstOrFail();
        abort_if($row->status === 'refunded', 409, 'Vatar: refunded');

        return ['granted' => $granted, 'player' => $player->fresh(), 'purchase' => $api->deliver($row)];
    }

    /**
     * Game items bought on Lagos Life that the game has not applied yet.
     *
     * @return list<array{id: string, type: string, item: string, quantity: int}>
     */
    public static function pendingGrants(MamaputPlayer $player): array
    {
        if (! $player->vatar_player_id) {
            return [];
        }

        return VatarPurchase::where('vatar_player_id', $player->vatar_player_id)
            ->where('item', 'like', 'mamaput:%')->whereNotNull('granted_at')
            ->whereNull('applied_at')->where('status', '!=', 'refunded')->orderBy('id')->limit(50)->get()
            ->map(function (VatarPurchase $p): array {
                [, $type, $item] = explode(':', (string) $p->item, 3) + [null, '', ''];

                return ['id' => $p->purchase_id, 'type' => $type, 'item' => $item,
                    'quantity' => $type === 'cash' ? $p->quantity * 100 : $p->quantity];
            })->values()->all();
    }

    /** The game applied these grants to its save. */
    public static function ackGrants(MamaputPlayer $player, array $ids): int
    {
        if (! $player->vatar_player_id || ! $ids) {
            return 0;
        }

        return VatarPurchase::where('vatar_player_id', $player->vatar_player_id)
            ->whereIn('purchase_id', array_slice(array_map('strval', $ids), 0, 50))
            ->where('item', 'like', 'mamaput:%')->whereNull('applied_at')->update(['applied_at' => now()]);
    }

    public static function balance(MamaputPlayer $player): int
    {
        return $player->user_id
            ? (int) (GameProfile::where('user_id', $player->user_id)->value('coins') ?? 1000)
            : (int) $player->wallet;
    }

    /** Coins earned today from shifts (Lagos time), for the daily cap. */
    public static function earnedToday(MamaputPlayer $player): int
    {
        return (int) MamaputWalletLog::where('player_id', $player->id)->where('reason', 'shift')
            ->where('created_at', '>=', now('Africa/Lagos')->startOfDay()->utc())->sum('amount');
    }

    /**
     * Adds (or with a negative amount, takes) coins and logs it. Account
     * holders also see the change in the Lagos War coin ledger.
     */
    public static function credit(MamaputPlayer $player, int $amount, string $reason, ?string $ref = null): int
    {
        return DB::transaction(function () use ($player, $amount, $reason, $ref): int {
            if ($player->user_id) {
                GameProfile::firstOrCreate(['user_id' => $player->user_id]);
                $profile = GameProfile::where('user_id', $player->user_id)->lockForUpdate()->firstOrFail();
                abort_if($amount < 0 && $profile->coins < -$amount, 422, 'Not enough coins.');
                CoinStakes::adjust($profile, $amount, 'mamaput_'.$reason);
                $balance = (int) $profile->coins;
            } else {
                $row = MamaputPlayer::whereKey($player->id)->lockForUpdate()->firstOrFail();
                abort_if($amount < 0 && $row->wallet < -$amount, 422, 'Not enough coins.');
                $row->wallet = max(0, $row->wallet + $amount);
                $row->save();
                $player->wallet = $row->wallet;
                $balance = (int) $row->wallet;
            }
            MamaputWalletLog::create([
                'player_id' => $player->id, 'user_id' => $player->user_id, 'amount' => $amount,
                'balance' => $balance, 'reason' => $reason, 'ref' => $ref,
            ]);

            return $balance;
        });
    }
}
