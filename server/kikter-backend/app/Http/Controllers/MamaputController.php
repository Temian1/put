<?php

namespace App\Http\Controllers;

use App\MamaputAccounts;
use App\MamaputConfig;
use App\Models\GameProfile;
use App\Models\MamaputPlayer;
use App\Models\User;
use App\Models\VatarPurchase;
use App\Models\VatarSetting;
use App\VatarApi;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

/**
 * API for Mama Put Rush (frontend on Vercel). Players authenticate with a
 * bearer token: a guest token from POST /players, or one issued when they
 * sign in with a Kikter account (/auth/login, /auth/register) or Lagos Life
 * (/auth/lagoslife). Signing in on a device links or merges its guest.
 */
class MamaputController extends Controller
{
    private const MAX_SAVE_BYTES = 65536;

    public function config(): JsonResponse
    {
        return response()->json(MamaputConfig::forClient());
    }

    public function register(Request $request): JsonResponse
    {
        abort_unless(MamaputConfig::get('guests_allowed'), 403, 'Sign in or create an account to play.');
        $data = $request->validate(['name' => ['nullable', 'string', 'min:2', 'max:30']]);
        [$player, $token] = MamaputPlayer::issue($this->cleanName($data['name'] ?? null));

        return response()->json(['id' => $player->id, 'name' => $player->name, 'token' => $token], 201);
    }

    /** Creates a Kikter account (the same one Lagos War uses) and signs in. */
    public function signUp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:30'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'password' => ['required', 'string', Password::defaults()],
        ]);
        $user = User::create([
            'name' => $this->cleanName($data['name']) ?? 'Mama Put', 'email' => $data['email'], 'password' => $data['password'],
        ]);
        GameProfile::firstOrCreate(['user_id' => $user->id]);

        return $this->signedIn($request, MamaputAccounts::signIn($this->current($request), $user, null), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        $user = User::where('email', mb_strtolower($data['email']))->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'Wrong email or password.']);
        }
        abort_if($user->banned_at, 403, 'This account has been suspended.');

        return $this->signedIn($request, MamaputAccounts::signIn($this->current($request), $user, null));
    }

    /** Signs in with a Lagos Life session from the Vatar SDK. */
    public function lagosLife(Request $request, VatarApi $api): JsonResponse
    {
        abort_unless(MamaputConfig::get('lagoslife_enabled'), 403, 'Lagos Life sign-in is switched off.');
        $data = $request->validate(['session' => ['required', 'string', 'max:8192']]);
        $vatar = $api->using(VatarSetting::mamaput())->player($data['session']);

        return $this->signedIn($request, MamaputAccounts::signIn($this->current($request), null, $vatar));
    }

    public function logout(Request $request): JsonResponse
    {
        if ($token = $request->bearerToken()) {
            MamaputPlayer::revokeToken($token);
        }

        return response()->json(['ok' => true]);
    }

    public function wallet(Request $request): JsonResponse
    {
        return response()->json($this->walletState($this->player($request)));
    }

    /** Swaps wallet coins for in-game naira; the game adds the cash to its save. */
    public function exchange(Request $request): JsonResponse
    {
        $player = $this->player($request);
        abort_if($player->source() === 'guest', 403, 'Sign in to use coins.');
        $min = max(1, (int) MamaputConfig::get('coins_exchange_min'));
        $data = $request->validate(['coins' => ['required', 'integer', 'min:'.$min, 'max:1000000']]);
        $cash = $data['coins'] * (int) MamaputConfig::get('coin_naira_rate');
        MamaputAccounts::credit($player, -$data['coins'], 'exchange', '₦'.$cash);

        return response()->json(['cash' => $cash] + $this->walletState($player));
    }

    /**
     * Delivers a Lagos Life purchase: the product's coins go to the wallet
     * once per purchase, however often the game asks.
     */
    public function purchase(Request $request, VatarApi $api): JsonResponse
    {
        $player = $this->player($request);
        $data = $request->validate([
            'session' => ['required', 'string', 'max:8192'],
            'purchaseId' => ['required', 'string', 'regex:/^[a-zA-Z0-9_-]{1,100}$/'],
        ]);
        $api = $api->using(VatarSetting::mamaput());
        $vatar = $api->player($data['session']);
        abort_unless($player->vatar_player_id === $vatar->id, 403, 'Sign in with Lagos Life first.');
        $remote = $api->call('GET', '/purchases/'.rawurlencode($data['purchaseId']));
        abort_unless(($remote['id'] ?? null) === $data['purchaseId'] && ($remote['mode'] ?? null) === $vatar->mode
            && ($remote['playerId'] ?? null) === $vatar->player_id, 403, 'Purchase belongs to another player.');
        abort_unless(in_array($remote['status'] ?? null, ['paid', 'delivered', 'refunded'], true), 422, 'Purchase is not paid.');
        $product = MamaputConfig::product((string) ($remote['productId'] ?? ''));
        abort_unless($product, 422, 'This product is not on sale in Mama Put.');
        $granted = DB::transaction(function () use ($data, $vatar, $remote, $product, $player): bool {
            $row = VatarPurchase::firstOrCreate(
                ['mode' => $vatar->mode, 'game_id' => $vatar->game_id, 'purchase_id' => $data['purchaseId']],
                ['vatar_player_id' => $vatar->id, 'product_id' => $remote['productId'], 'status' => $remote['status'],
                    'item' => 'mamaput_coins', 'quantity' => max(1, min(65000, (int) $product['coins']))],
            );
            $row = VatarPurchase::whereKey($row->id)->lockForUpdate()->firstOrFail();
            abort_unless($row->vatar_player_id === $vatar->id && $row->item === 'mamaput_coins', 409, 'Purchase identity mismatch.');
            $row->status = $remote['status'];
            $grant = $row->status !== 'refunded' && ! $row->granted_at;
            if ($grant) {
                $row->granted_at = now();
                MamaputAccounts::credit($player, $row->quantity, 'lagoslife_purchase', $row->purchase_id);
            }
            if ($row->status === 'delivered') {
                $row->delivered_at ??= now();
            }
            $row->save();

            return $grant;
        });
        $row = VatarPurchase::where('mode', $vatar->mode)->where('purchase_id', $data['purchaseId'])->firstOrFail();
        abort_if($row->status === 'refunded', 409, 'This purchase was refunded.');
        $api->deliver($row);

        return response()->json(['granted' => $granted] + $this->walletState($player->fresh()));
    }

    public function me(Request $request): JsonResponse
    {
        $player = $this->player($request);

        return response()->json($this->profile($player));
    }

    public function rename(Request $request): JsonResponse
    {
        $player = $this->player($request);
        $data = $request->validate(['name' => ['required', 'string', 'min:2', 'max:30']]);
        $player->name = $this->cleanName($data['name']) ?: $player->name;
        $player->save();

        return response()->json($this->profile($player));
    }

    public function showSave(Request $request): JsonResponse
    {
        $player = $this->player($request);

        return response()->json(['version' => $player->save_version, 'save' => $player->save]);
    }

    /**
     * Stores the save only when the client edited the latest version; otherwise
     * returns 409 with the server copy so the game can merge and retry.
     */
    public function storeSave(Request $request): JsonResponse
    {
        $player = $this->player($request);
        $data = $request->validate([
            'version' => ['required', 'integer', 'min:0'],
            'save' => ['required', 'array'],
            'save.unlocked' => ['required', 'integer', 'min:1', 'max:101'],
            'save.coins' => ['required', 'numeric', 'min:0'],
        ]);
        if (strlen((string) $request->getContent()) > self::MAX_SAVE_BYTES) {
            return response()->json(['message' => 'Save is too large.'], 413);
        }
        if ((int) $data['version'] !== $player->save_version) {
            return response()->json(['version' => $player->save_version, 'save' => $player->save], 409);
        }
        // validate() keeps only the checked keys; store the whole save.
        $player->syncFromSave((array) $request->input('save'));
        $player->save_version++;
        $player->last_seen_at = now();
        $player->save();

        return response()->json(['version' => $player->save_version]);
    }

    public function shift(Request $request): JsonResponse
    {
        $player = $this->player($request);
        $data = $request->validate([
            'mode' => ['required', 'in:level,daily,endless'],
            'level' => ['nullable', 'integer', 'min:0', 'max:100'],
            'won' => ['required', 'boolean'],
            'served' => ['required', 'integer', 'min:0', 'max:1000'],
            'lost' => ['required', 'integer', 'min:0', 'max:1000'],
            'sales' => ['required', 'integer', 'min:0'],
            'cash' => ['required', 'integer'],
            'stars' => ['required', 'integer', 'min:0', 'max:3'],
            'duration' => ['required', 'integer', 'min:0', 'max:7200'],
        ]);
        // Flag shifts no honest player can reach, so admins can review them.
        $data['flagged'] = $data['sales'] > (int) MamaputConfig::get('max_sales_per_shift')
            || ($data['duration'] > 0 && $data['served'] / max(1, $data['duration']) > 1.5);
        $player->shifts()->create($data);
        $player->increment('shifts_played');
        $player->last_seen_at = now();
        $player->save();
        // Signed-in players earn coins for won shifts, up to a daily cap.
        $coins = 0;
        if ($data['won'] && ! $data['flagged'] && $player->source() !== 'guest') {
            $coins = max(0, min((int) MamaputConfig::get('coins_per_win'),
                (int) MamaputConfig::get('coins_daily_cap') - MamaputAccounts::earnedToday($player)));
            if ($coins > 0) {
                MamaputAccounts::credit($player, $coins, 'shift', $data['mode'].' '.($data['level'] ?? ''));
            }
        }

        return response()->json(['ok' => true, 'flagged' => $data['flagged'], 'coins' => $coins,
            'wallet' => $player->source() === 'guest' ? null : MamaputAccounts::balance($player)], 201);
    }

    /**
     * Real players only: banned players and flagged accounts are left out.
     */
    public function leaderboard(Request $request): JsonResponse
    {
        $board = $request->query('board', 'sales');
        $column = match ($board) {
            'stars' => 'stars',
            'endless' => 'endless_best',
            default => 'lifetime_sales',
        };
        // scope=lagoslife ranks only players signed in through Lagos Life.
        $lagosLife = $request->query('scope') === 'lagoslife';
        $base = fn () => MamaputPlayer::query()->whereNull('banned_at')
            ->when($lagosLife, fn ($q) => $q->whereNotNull('vatar_player_id'));
        $rows = $base()->where($column, '>', 0)
            ->orderByDesc($column)->orderBy('id')->limit(50)
            ->get(['id', 'name', $column, 'tier', 'restaurants', 'user_id', 'vatar_player_id']);
        $me = MamaputPlayer::findByToken($request->bearerToken());

        return response()->json([
            'board' => $board,
            'rows' => $rows->values()->map(fn (MamaputPlayer $p, int $i): array => [
                'rank' => $i + 1,
                'name' => $p->name,
                'value' => (int) $p->{$column},
                'tier' => MamaputConfig::TIERS[$p->tier][0] ?? '',
                'restaurants' => $p->restaurants,
                'source' => $p->source(),
                'you' => $me?->id === $p->id,
            ]),
            'me' => $me && ! $me->isBanned() ? [
                'rank' => $base()->where($column, '>', $me->{$column})->count() + 1,
                'name' => $me->name,
                'value' => (int) $me->{$column},
            ] : null,
            'scope' => $lagosLife ? 'lagoslife' : 'all',
            'players' => $base()->count(),
        ]);
    }

    private function player(Request $request): MamaputPlayer
    {
        $player = MamaputPlayer::findByToken($request->bearerToken());
        abort_if(! $player, 401, 'Unknown player.');
        abort_if($player->isBanned(), 403, 'This player has been suspended.');

        return $player;
    }

    /** The device's current player, if its token is valid (auth calls). */
    private function current(Request $request): ?MamaputPlayer
    {
        $player = MamaputPlayer::findByToken($request->bearerToken());
        abort_if($player?->isBanned(), 403, 'This player has been suspended.');

        return $player;
    }

    private function signedIn(Request $request, MamaputPlayer $player, int $status = 200): JsonResponse
    {
        abort_if($player->isBanned(), 403, 'This player has been suspended.');
        // The device swaps its guest (or previous) token for the new one.
        if ($old = $request->bearerToken()) {
            MamaputPlayer::revokeToken($old);
        }

        return response()->json(['token' => $player->newToken()] + $this->profile($player->fresh()), $status);
    }

    /** @return array<string, mixed> */
    private function walletState(MamaputPlayer $p): array
    {
        $signedIn = $p->source() !== 'guest';

        return [
            'coins' => $signedIn ? MamaputAccounts::balance($p) : 0,
            'earnedToday' => $signedIn ? MamaputAccounts::earnedToday($p) : 0,
            'signedIn' => $signedIn,
        ];
    }

    /** @return array<string, mixed> */
    private function profile(MamaputPlayer $p): array
    {
        $user = $p->user;

        return [
            'id' => $p->id, 'name' => $p->name, 'version' => $p->save_version,
            'tier' => MamaputConfig::TIERS[$p->tier][0] ?? '', 'shifts' => $p->shifts_played,
            'source' => $p->source(),
            'account' => $user ? ['name' => $user->name, 'email' => $user->email] : null,
            'lagoslife' => $p->vatarPlayer ? ['name' => $p->vatarPlayer->name] : null,
            'wallet' => $this->walletState($p),
        ];
    }

    private function cleanName(?string $name): ?string
    {
        $name = trim(preg_replace('/[^\pL\pN \'&.-]+/u', '', (string) $name));

        return $name !== '' ? mb_substr($name, 0, 30) : null;
    }
}
