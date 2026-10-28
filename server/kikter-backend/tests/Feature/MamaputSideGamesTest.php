<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MamaputSideGamesTest extends TestCase
{
    use RefreshDatabase;

    private function player(): string
    {
        return $this->postJson('/api/mamaput/players', ['name' => 'Runner'])
            ->assertCreated()->json('token');
    }

    public function test_okada_and_match_results_are_recorded_without_wallet_coins(): void
    {
        $token = $this->player();
        $auth = ['Authorization' => 'Bearer '.$token];
        foreach ([['okada', 3], ['match', 12]] as [$mode, $level]) {
            $this->postJson('/api/mamaput/shifts', [
                'mode' => $mode, 'level' => $level, 'won' => true, 'served' => 9,
                'lost' => 1, 'sales' => 12000, 'cash' => 11000, 'stars' => 2, 'duration' => 90,
            ], $auth)->assertCreated()->assertJsonPath('coins', 0);
        }
        $this->assertDatabaseHas('mamaput_shifts', ['mode' => 'okada', 'served' => 9]);
        $this->assertDatabaseHas('mamaput_shifts', ['mode' => 'match', 'level' => 12]);
    }

    public function test_side_game_progress_from_the_save_reaches_the_leaderboards(): void
    {
        $token = $this->player();
        $auth = ['Authorization' => 'Bearer '.$token];
        $this->putJson('/api/mamaput/save', ['version' => 0, 'save' => [
            'unlocked' => 55, 'coins' => 1000,
            'side' => ['run' => ['best' => 27], 'match' => ['level' => 9, 'stars' => ['1' => 3]], 'recipes' => ['nkwobi']],
        ]], $auth)->assertOk();
        $this->assertDatabaseHas('mamaput_players', ['okada_best' => 27, 'match_level' => 8]);

        $this->getJson('/api/mamaput/leaderboard?board=okada', $auth)->assertOk()
            ->assertJsonPath('rows.0.value', 27)->assertJsonPath('me.rank', 1);
        $this->getJson('/api/mamaput/leaderboard?board=match', $auth)->assertOk()
            ->assertJsonPath('rows.0.value', 8);
        // The whole save, side games included, comes back on another device.
        $this->getJson('/api/mamaput/save', $auth)->assertOk()
            ->assertJsonPath('save.side.recipes.0', 'nkwobi');
    }
}
