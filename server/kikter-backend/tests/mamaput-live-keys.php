<?php

// Run from the deployed Laravel root: php tests/mamaput-live-keys.php
// Reads configured keys without printing them. Uses an ignored webhook event,
// an invalid session, and an unsaved match; no player or purchase is created.
require getcwd().'/vendor/autoload.php';
$app = require getcwd().'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\VatarMatch;
use App\Models\VatarSetting;
use App\VatarApi;
use Illuminate\Support\Facades\Http;

function checkLiveKeys(bool $ok, string $check): void
{
    if (! $ok) {
        throw new RuntimeException('FAIL: '.$check);
    }
    echo 'PASS: '.$check.PHP_EOL;
}

$setting = VatarSetting::mamaput();
checkLiveKeys($setting->id === 2 && $setting->configured() && $setting->mode === 'live', 'Mama Put uses its own live configuration');
foreach (['secret' => 'vtr_live_', 'webhook_secret' => 'vtr_whsec_live_', 'results_secret' => 'vtr_rsec_live_'] as $field => $prefix) {
    checkLiveKeys(str_starts_with((string) $setting->{$field}, $prefix)
        && $setting->getRawOriginal($field) !== $setting->{$field}, $field.' is live and encrypted');
}

// A fake session distinguishes accepted credentials from an invalid API key.
$response = Http::withToken($setting->secret)->acceptJson()->withoutRedirecting()->timeout(15)
    ->post(VatarApi::BASE.'/session/verify', ['session' => 'integration-probe-invalid-session']);
checkLiveKeys($response->status() === 401 && $response->json('error') === 'invalid_token', 'platform accepts the API key and rejects the fake session');
$control = Http::withToken('vtr_live_invalid_integration_probe')->acceptJson()->withoutRedirecting()->timeout(15)
    ->post(VatarApi::BASE.'/session/verify', ['session' => 'integration-probe-invalid-session']);
checkLiveKeys($control->status() === 401 && $control->json('error') === 'bad_secret', 'platform rejects an invalid API key');

$webhook = rtrim(config('app.url'), '/').'/api/mamaput/lagoslife/webhook';
foreach ([['live', true, 202], ['live', false, 401], ['test', true, 403]] as [$mode, $valid, $expected]) {
    $raw = json_encode(['id' => 'mamaput-key-smoke', 'type' => 'integration.check', 'mode' => $mode, 'data' => ['probe' => true]], JSON_THROW_ON_ERROR);
    $signature = 'sha256='.hash_hmac('sha256', $raw, $valid ? $setting->webhook_secret : 'invalid-probe-key');
    $response = Http::acceptJson()->withoutRedirecting()->timeout(15)->withHeaders(['X-Vatar-Signature' => $signature])
        ->withBody($raw, 'application/json')->post($webhook);
    checkLiveKeys($response->status() === $expected, 'webhook '.$mode.' '.($valid ? 'signed' : 'invalid-signature').' returns '.$expected);
    if ($expected === 202) {
        checkLiveKeys($response->json('accepted') === true && $response->json('handled') === false, 'webhook probe has no purchase side effects');
    }
}

// Exercise signing with a game-specific setting and an unsaved match.
// A distinct fixture key makes using the shared game's key fail this check.
$signing = clone $setting;
$signing->results_secret = 'vtr_rsec_live_fixture_for_scope_test';
Http::preventStrayRequests();
$signatureVerified = false;
Http::fake(function ($request) use ($signing, &$signatureVerified) {
    $timestamp = $request->header('X-Vatar-Timestamp')[0] ?? '';
    $message = implode("\n", ['POST', '/api/games/v1/matches/smoke_match/result', $timestamp, 'smoke-nonce', hash('sha256', $request->body())]);
    $expected = 'v1='.hash_hmac('sha256', $message, $signing->results_secret);
    $signatureVerified = $request->url() === VatarApi::BASE.'/matches/smoke_match/result'
        && $request->hasHeader('Authorization', 'Bearer '.$signing->secret)
        && $request->hasHeader('X-Vatar-Signature', $expected);

    return Http::response(['id' => 'smoke_match', 'status' => 'done', 'winner' => 'p_smoke']);
});
$match = new VatarMatch;
$match->platform_match_id = 'smoke_match';
$match->nonce = 'smoke-nonce';
$match->winner = 'p_smoke';
$result = app(VatarApi::class)->using($signing)->settle($match);
checkLiveKeys($result['settled'] === true && ! $match->exists, 'result signing runs without creating a match');
checkLiveKeys($signatureVerified, 'result signature uses the selected game signing key');
