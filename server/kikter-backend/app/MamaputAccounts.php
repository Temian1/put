<?php

namespace App;

use App\Models\GameProfile;
use App\Models\MamaputPlayer;
use App\Models\MamaputWalletLog;
use App\Models\User;
use App\Models\VatarPlayer;
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
