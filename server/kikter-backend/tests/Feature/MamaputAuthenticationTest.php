<?php

namespace Tests\Feature;

use App\MamaputConfig;
use App\Models\MamaputPlayer;
use App\Models\VatarSetting;
use App\VatarApi;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MamaputAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_registration_cannot_be_enabled(): void
    {
        MamaputConfig::store(['guests_allowed' => true]);
        $this->postJson('/api/mamaput/players', ['name' => 'Guest'])->assertForbidden();
        $this->getJson('/api/mamaput/config')->assertOk()->assertJsonPath('accounts.guests', false);
        $this->assertDatabaseCount('mamaput_players', 0);
    }

    public function test_existing_guest_tokens_cannot_save_play_or_appear_on_rankings(): void
    {
        [$guest, $token] = MamaputPlayer::issue('Mama Put 1234');
        $guest->lifetime_sales = 100000;
        $guest->save();
        $auth = ['Authorization' => 'Bearer '.$token];
        $this->getJson('/api/mamaput/me', $auth)->assertUnauthorized();
        $this->getJson('/api/mamaput/save', $auth)->assertUnauthorized();
        $this->putJson('/api/mamaput/save', ['version' => 0, 'save' => ['unlocked' => 1, 'coins' => 3000]], $auth)->assertUnauthorized();
        $this->postJson('/api/mamaput/shifts', [], $auth)->assertUnauthorized();
        $this->getJson('/api/mamaput/leaderboard', $auth)->assertOk()->assertJsonCount(0, 'rows')->assertJsonPath('players', 0)->assertJsonPath('me', null);
    }

    public function test_lagos_life_auto_registers_with_verified_username_and_refreshes_it(): void
    {
        VatarSetting::create(['id' => 2, 'enabled' => true, 'mode' => 'test', 'secret' => 'vtr_test_fixture']);
        Http::preventStrayRequests();
        $identity = ['playerId' => 't_auth', 'gameId' => 'game_mamaput', 'name' => 'Display Name', 'username' => 'ola_real_62', 'mode' => 'test', 'exp' => now()->addMinutes(10)->getTimestampMs()];
        Http::fake([VatarApi::BASE.'/session/verify' => Http::sequence()
            ->push($identity)->push(array_merge($identity, ['username' => 'ola_new_name']))]);
        $first = $this->postJson('/api/mamaput/auth/lagoslife', ['session' => 'verified-session'])
            ->assertOk()->assertJsonPath('name', 'ola_real_62')->assertJsonPath('source', 'lagoslife');
        $id = $first->json('id');
        $this->assertDatabaseCount('mamaput_players', 1);
        $this->postJson('/api/mamaput/auth/lagoslife', ['session' => 'new-session'])
            ->assertOk()->assertJsonPath('id', $id)->assertJsonPath('name', 'ola_new_name');
        $this->assertDatabaseCount('mamaput_players', 1);
    }
}
