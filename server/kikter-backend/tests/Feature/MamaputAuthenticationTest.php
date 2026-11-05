<?php

namespace Tests\Feature;

use App\MamaputConfig;
use App\MamaputAccounts;
use App\Models\MamaputPlayer;
use App\Models\User;
use App\Models\VatarPlayer;
use App\Models\VatarSetting;
use App\VatarApi;
use App\Filament\Resources\Users\Pages\ListUsers;
use App\Filament\Resources\Users\Pages\EditUser;
use Filament\Facades\Filament;
use Livewire\Livewire;
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
        $first->assertJsonPath('account.email', null)->assertJsonPath('account.name', 'ola_real_62');
        $this->assertDatabaseCount('users', 1);
        $accountId = VatarPlayer::firstOrFail()->user_id;
        $this->assertNotNull($accountId);
        $this->assertNull(User::findOrFail($accountId)->email);
        $this->assertDatabaseCount('mamaput_players', 1);
        $this->postJson('/api/mamaput/auth/lagoslife', ['session' => 'new-session'])
            ->assertOk()->assertJsonPath('id', $id)->assertJsonPath('name', 'ola_new_name');
        $this->assertDatabaseCount('mamaput_players', 1);
        $this->assertDatabaseCount('users', 1);
        $this->assertSame($accountId, VatarPlayer::firstOrFail()->user_id);
        $this->assertSame('ola_new_name', User::findOrFail($accountId)->name);
    }

    public function test_backfill_registers_existing_identity_without_changing_game_money_or_save(): void
    {
        $identity = VatarPlayer::create(['mode' => 'live', 'game_id' => 'mamaput', 'player_id' => 'p_existing', 'name' => 'Ada']);
        [$player] = MamaputPlayer::issue('Ada');
        $player->vatar_player_id = $identity->id;
        $player->wallet = 321;
        $player->save = ['coins' => 78000, 'unlocked' => 25, 'till' => ['ch0' => 300000]];
        $player->save();
        $before = $player->fresh()->getRawOriginal();
        $user = MamaputAccounts::registerPlatformIdentity($identity);
        $again = MamaputAccounts::registerPlatformIdentity($identity);
        $this->assertSame($user->id, $again->id);
        $this->assertSame($before, $player->fresh()->getRawOriginal());
        $this->assertSame(0, $user->gameProfile->coins);
        $this->assertDatabaseCount('users', 1);
        $user->forceFill(['banned_at' => now()])->save();
        $this->assertTrue($player->fresh()->isBanned());
        $this->withToken($player->newToken())->getJson('/api/mamaput/me')->assertForbidden();
    }

    public function test_existing_email_account_is_reused_without_being_overwritten(): void
    {
        $user = User::factory()->create(['email' => 'ada@example.test']);
        $identity = VatarPlayer::create(['mode' => 'live', 'game_id' => 'mamaput', 'player_id' => 'p_linked', 'name' => 'Ada LL']);
        $registered = MamaputAccounts::registerPlatformIdentity($identity, $user);
        $this->assertSame($user->id, $registered->id);
        $this->assertSame('ada@example.test', $registered->email);
        $this->assertDatabaseCount('users', 1);
    }

    public function test_registered_lagoslife_account_is_visible_and_editable_in_users_without_email(): void
    {
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $this->actingAs($admin);
        Filament::setCurrentPanel(array_values(Filament::getPanels())[0]);
        $identity = VatarPlayer::create(['mode' => 'live', 'game_id' => 'mamaput', 'player_id' => 'p_visible', 'name' => 'Bisi']);
        $account = MamaputAccounts::registerPlatformIdentity($identity);
        Livewire::test(ListUsers::class)->assertCanSeeTableRecords([$account])->assertSee('email not shared');
        Livewire::test(EditUser::class, ['record' => $account->id])->call('save')->assertHasNoFormErrors();
        $this->assertNull($account->fresh()->email);
    }

}
