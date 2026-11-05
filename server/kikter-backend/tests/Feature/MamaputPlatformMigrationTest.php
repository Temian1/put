<?php

namespace Tests\Feature;

use App\Models\MamaputPlayer;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Tests\TestCase;

class MamaputPlatformMigrationTest extends TestCase
{
    use DatabaseTruncation;

    protected function setUp(): void
    {
        RefreshDatabaseState::$migrated = false;
        parent::setUp();
    }

    protected function tearDown(): void
    {
        RefreshDatabaseState::$migrated = false;
        parent::tearDown();
    }

    public function test_nullable_email_migration_preserves_existing_accounts_and_player_links(): void
    {
        $migration = require database_path('migrations/2026_11_05_120000_register_lagoslife_platform_accounts.php');
        $migration->down();
        $user = User::factory()->create(['email' => 'existing@example.test']);
        [$player] = MamaputPlayer::issue('Existing');
        $player->user_id = $user->id;
        $player->wallet = 500;
        $player->save();
        $migration->up();
        $this->assertSame('existing@example.test', $user->fresh()->email);
        $this->assertSame($user->id, $player->fresh()->user_id);
        $this->assertSame(500, $player->fresh()->wallet);
    }
}
