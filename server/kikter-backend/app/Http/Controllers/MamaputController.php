<?php

namespace App\Http\Controllers;

use App\MamaputConfig;
use App\Models\MamaputPlayer;
use App\Models\MamaputShift;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * API for Mama Put Rush (frontend on Vercel). Players authenticate with the
 * bearer token issued by POST /api/mamaput/players.
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
        $data = $request->validate(['name' => ['nullable', 'string', 'min:2', 'max:30']]);
        [$player, $token] = MamaputPlayer::issue($this->cleanName($data['name'] ?? null));

        return response()->json(['id' => $player->id, 'name' => $player->name, 'token' => $token], 201);
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

        return response()->json(['ok' => true, 'flagged' => $data['flagged']], 201);
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
        $rows = MamaputPlayer::query()->whereNull('banned_at')->where($column, '>', 0)
            ->orderByDesc($column)->orderBy('id')->limit(50)
            ->get(['id', 'name', $column, 'tier', 'restaurants']);
        $me = MamaputPlayer::findByToken($request->bearerToken());

        return response()->json([
            'board' => $board,
            'rows' => $rows->values()->map(fn (MamaputPlayer $p, int $i): array => [
                'rank' => $i + 1,
                'name' => $p->name,
                'value' => (int) $p->{$column},
                'tier' => MamaputConfig::TIERS[$p->tier][0] ?? '',
                'restaurants' => $p->restaurants,
                'you' => $me?->id === $p->id,
            ]),
            'me' => $me && ! $me->isBanned() ? [
                'rank' => MamaputPlayer::query()->whereNull('banned_at')->where($column, '>', $me->{$column})->count() + 1,
                'name' => $me->name,
                'value' => (int) $me->{$column},
            ] : null,
            'players' => MamaputPlayer::query()->whereNull('banned_at')->count(),
        ]);
    }

    private function player(Request $request): MamaputPlayer
    {
        $player = MamaputPlayer::findByToken($request->bearerToken());
        abort_if(! $player, 401, 'Unknown player.');
        abort_if($player->isBanned(), 403, 'This player has been suspended.');

        return $player;
    }

    /** @return array<string, mixed> */
    private function profile(MamaputPlayer $p): array
    {
        return [
            'id' => $p->id, 'name' => $p->name, 'version' => $p->save_version,
            'tier' => MamaputConfig::TIERS[$p->tier][0] ?? '', 'shifts' => $p->shifts_played,
        ];
    }

    private function cleanName(?string $name): ?string
    {
        $name = trim(preg_replace('/[^\pL\pN \'&.-]+/u', '', (string) $name));

        return $name !== '' ? mb_substr($name, 0, 30) : null;
    }
}
