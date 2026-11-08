<?php

namespace Tests\Feature;

use App\MamaputAccounts;
use App\Models\MamaputPlayer;
use App\Models\User;
use App\Models\VatarPlayer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MamaputSaveRecoveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_stale_save_cannot_overwrite_repaired_cash_even_after_fetching_latest_version(): void
    {
        $user = User::factory()->create();
        [$player, $token] = MamaputPlayer::issue('Olamide');
        $player->user_id = $user->id;
        $player->syncFromSave(['coins' => 24872000, 'unlocked' => 68, 'saveEpoch' => 1, 'stars' => ['1' => 3, '67' => 3]]);
        $player->save_version = 20;
        $player->save();
        $auth = ['Authorization' => 'Bearer '.$token];
        $this->putJson('/api/mamaput/save', ['version' => 20, 'save' => [
            'coins' => 272000, 'unlocked' => 2, 'stars' => ['1' => 1], 'updatedAt' => 9999999999999,
        ]], $auth)->assertConflict()->assertJsonPath('save.coins', 24872000);
        $this->putJson('/api/mamaput/save', ['version' => 20, 'save' => [
            'coins' => 24870000, 'unlocked' => 2, 'saveEpoch' => 1, 'stars' => ['2' => 2],
        ]], $auth)->assertOk();
        $this->getJson('/api/mamaput/save', $auth)->assertOk()
            ->assertJsonPath('save.coins', 24870000)->assertJsonPath('save.unlocked', 68)
            ->assertJsonPath('save.stars.1', 3)->assertJsonPath('save.stars.2', 2)->assertJsonPath('save.stars.67', 3);
        $this->putJson('/api/mamaput/save', ['version' => 20, 'save' => [
            'coins' => 1, 'unlocked' => 1, 'saveEpoch' => 1,
        ]], $auth)->assertConflict();
    }

    public function test_wallet_is_transferred_once_when_accounts_link(): void
    {
        $user = User::factory()->create();
        $identity = VatarPlayer::create(['mode' => 'live', 'game_id' => 'mamaput', 'player_id' => 'p_ola', 'name' => 'Olamide']);
        [$player] = MamaputPlayer::issue('Olamide');
        $player->vatar_player_id = $identity->id;
        $player->wallet = 10;
        $player->save();
        $linked = MamaputAccounts::signIn($player, $user, null);
        $this->assertSame(0, (int) $linked->fresh()->wallet);
        $balance = MamaputAccounts::balance($linked);
        $again = MamaputAccounts::signIn($linked, null, $identity);
        $this->assertSame($balance, MamaputAccounts::balance($again));
        $this->assertSame(1, $again->walletLogs()->where('reason', 'linked')->count());
    }
}
