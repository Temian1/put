<?php

namespace App;

use App\Models\VatarMatch;
use App\Models\VatarPlayer;
use App\Models\VatarPurchase;
use App\Models\VatarSetting;
use App\Models\VatarWebhook;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpKernel\Exception\HttpException;

class VatarApi
{
    public const BASE = 'https://lagoslife.app/api/games/v1';

    private ?VatarSetting $setting = null;

    /** The same client for another Lagos Life game's keys (e.g. Mama Put). */
    public function using(VatarSetting $setting): static
    {
        $api = clone $this;
        $api->setting = $setting;

        return $api;
    }

    public function setting(): VatarSetting
    {
        return $this->setting ?? VatarSetting::current();
    }

    public function retryPending(): void
    {
        Cache::lock('vatar-deliveries', 60)->get(function (): void {
            $mode = VatarSetting::current()->mode;
            $pending = collect([
                VatarWebhook::where('mode', $mode)->whereNull('processed_at')->oldest('updated_at')->first(),
                VatarPurchase::where('mode', $mode)->where('status', 'paid')->whereNull('delivered_at')->oldest('updated_at')->first(),
                VatarMatch::where('mode', $mode)->whereNotNull('worker_match_id')->whereNull('settled_at')->oldest('updated_at')->first(),
            ])->filter()->sortBy('updated_at')->first();
            if ($pending instanceof VatarWebhook) {
                $event = $pending;
                try {
                    if ($event->type === 'purchase.paid') {
                        $id = $event->payload['purchaseId'] ?? null;
                        if (! is_string($id) || ! preg_match('/^[a-zA-Z0-9_-]{1,100}$/', $id)) {
                            $event->update(['processed_at' => now()]);

                            return;
                        }
                        $this->grant($id);
                    }
                    $event->update(['processed_at' => now()]);
                } catch (HttpException) {
                    $event->touch();
                }

                return;
            }
            if ($pending instanceof VatarPurchase) {
                $purchase = $pending;
                try {
                    $this->grant($purchase->purchase_id, VatarPlayer::findOrFail($purchase->vatar_player_id));
                } catch (HttpException) {
                    $purchase->touch();
                }

                return;
            }
            if ($pending instanceof VatarMatch) {
                $match = $pending;
                try {
                    $this->settle($match);
                } catch (HttpException) {
                    $match->touch();
                }
            }
        });
    }

    public function call(string $method, string $path, ?array $body = null, array $headers = []): array
    {
        $setting = $this->setting();
        abort_unless($setting->configured(), 503, 'Vatar integration is not configured.');
        $raw = $body === null ? null : json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        try {
            $request = Http::withToken($setting->secret)->acceptJson()->connectTimeout(3)->timeout(8)
                ->withoutRedirecting()->withHeaders($headers);
            if ($raw !== null) {
                $request = $request->withBody($raw, 'application/json');
            }
            $response = $request->send($method, self::BASE.$path);
        } catch (ConnectionException) {
            abort(503, 'Vatar is temporarily unreachable. Try again.');
        }
        if (! $response->successful()) {
            $code = $response->json('error');
            $allowed = ['expired', 'invalid_token', 'wrong_game', 'wrong_mode', 'refunded', 'not_found', 'not_playing', 'already_settled', 'rate_limited'];
            abort(in_array($response->status(), [400, 401, 403, 404, 409, 429], true) ? $response->status() : 503,
                'Vatar: '.(in_array($code, $allowed, true) ? $code : 'request_failed'));
        }
        $data = $response->json();
        abort_unless(is_array($data), 502, 'Invalid Vatar response.');

        return $data;
    }

    public function player(string $session): VatarPlayer
    {
        $me = $this->call('POST', '/session/verify', ['session' => $session]);
        $mode = $this->setting()->mode;
        abort_unless(($me['mode'] ?? null) === $mode, 403, 'Vatar: wrong_mode');
        abort_unless(is_string($me['playerId'] ?? null) && is_string($me['gameId'] ?? null) &&
            strlen($me['playerId']) <= 100 && strlen($me['gameId']) <= 100 && $me['gameId'] !== '' &&
            str_starts_with($me['playerId'], $mode === 'test' ? 't_' : 'p_') &&
            is_numeric($me['exp'] ?? null) && (float) $me['exp'] > now()->getTimestampMs(), 401, 'Invalid or expired Vatar session.');
        $player = VatarPlayer::firstOrCreate(
            ['mode' => $mode, 'game_id' => $me['gameId'], 'player_id' => $me['playerId']],
            ['name' => mb_substr((string) ($me['name'] ?? 'Fighter'), 0, 100)]
        );
        $player->update(['name' => mb_substr((string) ($me['name'] ?? 'Fighter'), 0, 100)]);

        return $player;
    }

    public function grant(string $purchaseId, ?VatarPlayer $owner = null): VatarPurchase
    {
        $remote = $this->call('GET', '/purchases/'.rawurlencode($purchaseId));
        $setting = $this->setting();
        abort_unless(($remote['mode'] ?? null) === $setting->mode && ($remote['id'] ?? null) === $purchaseId, 403, 'Vatar purchase mode or ID mismatch.');
        abort_unless(in_array($remote['status'] ?? null, ['paid', 'delivered', 'refunded'], true), 422, 'Purchase is not paid.');
        if ($owner === null) {
            $owner = VatarPlayer::where('mode', $setting->mode)->where('player_id', $remote['playerId'] ?? '')->first();
            abort_unless($owner, 503, 'Player must initialize the game before delivery.');
        }
        abort_unless(($remote['playerId'] ?? null) === $owner->player_id && $owner->mode === $setting->mode, 403, 'Purchase belongs to another player.');
        $product = $setting->product((string) ($remote['productId'] ?? ''));
        $item = ($product['type'] ?? 'skin') === 'item' && isset(GameStore::ITEMS[$product['item'] ?? '']) ? $product['item'] : null;
        abort_unless($product && ($item || preg_match('/^#[a-fA-F0-9]{6}$/', $product['skin'] ?? '')), 422, 'Product is not mapped to a suit or store item.');
        $purchase = DB::transaction(function () use ($purchaseId, $owner, $remote, $product, $item): VatarPurchase {
            $row = VatarPurchase::firstOrCreate(
                ['mode' => $owner->mode, 'game_id' => $owner->game_id, 'purchase_id' => $purchaseId],
                [
                    'vatar_player_id' => $owner->id, 'product_id' => $remote['productId'], 'status' => $remote['status'],
                    'skin' => $item ? null : $product['skin'], 'item' => $item,
                    'quantity' => $item ? max(1, min(100, (int) ($product['quantity'] ?? 1))) : 1,
                ]
            );
            $row = VatarPurchase::whereKey($row->id)->lockForUpdate()->firstOrFail();
            abort_unless($row->vatar_player_id === $owner->id && $row->product_id === $remote['productId'], 409, 'Purchase identity mismatch.');
            $row->status = $remote['status'];
            if ($row->status !== 'refunded' && ! $row->granted_at) {
                $row->granted_at = now();
                if ($row->item) {
                    // Each paid purchase adds its gear exactly once, so repeat buys of a consumable stack.
                    $player = VatarPlayer::whereKey($owner->id)->lockForUpdate()->firstOrFail();
                    $progress = $player->progress ?? [];
                    $progress['inventory'] = GameStore::add($progress['inventory'] ?? [], $row->item, $row->quantity);
                    $player->update(['progress' => $progress]);
                }
            }
            if ($row->status === 'delivered') {
                $row->delivered_at ??= now();
            }
            $row->save();

            return $row;
        });
        if ($purchase->status === 'refunded') {
            abort(409, 'Vatar: refunded');
        }

        return $this->deliver($purchase);
    }

    public function deliver(VatarPurchase $purchase): VatarPurchase
    {
        if ($purchase->delivered_at || $purchase->status === 'refunded') {
            return $purchase;
        }
        $remote = $this->call('POST', '/purchases/'.rawurlencode($purchase->purchase_id).'/deliver', []);
        abort_unless(($remote['id'] ?? null) === $purchase->purchase_id && ($remote['status'] ?? null) === 'delivered', 502, 'Invalid delivery confirmation.');
        $purchase->update(['status' => 'delivered', 'delivered_at' => now()]);

        return $purchase;
    }

    public function settle(VatarMatch $match): array
    {
        if ($match->settled_at) {
            return ['settled' => true];
        }
        $key = VatarSetting::current()->results_secret;
        abort_unless(filled($key), 503, 'Vatar result signing is not configured.');
        $path = '/api/games/v1/matches/'.rawurlencode($match->platform_match_id).'/result';
        $body = ['winner' => $match->winner];
        $raw = json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $timestamp = (string) time();
        $signature = 'v1='.hash_hmac('sha256', implode("\n", ['POST', $path, $timestamp, $match->nonce, hash('sha256', $raw)]), $key);
        $remote = $this->call('POST', '/matches/'.rawurlencode($match->platform_match_id).'/result', $body, [
            'X-Vatar-Timestamp' => $timestamp, 'X-Vatar-Signature' => $signature,
        ]);
        abort_unless(($remote['id'] ?? null) === $match->platform_match_id &&
            ($remote['status'] ?? null) === 'done' && ($remote['winner'] ?? null) === $match->winner, 502, 'Invalid Vatar match settlement.');
        $match->update(['settled_at' => now()]);

        return ['settled' => true];
    }
}
