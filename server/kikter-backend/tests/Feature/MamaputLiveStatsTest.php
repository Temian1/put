<?php

namespace Tests\Feature;

use App\Filament\Resources\MamaputPlayers\Pages\ManageMamaputPlayers;
use App\Filament\Widgets\MamaputStatsOverview;
use App\Models\MamaputPlayer;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class MamaputLiveStatsTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_counts_follow_current_restaurant_crews_instead_of_legacy_staff(): void
    {
        [$p] = MamaputPlayer::issue('Ada');
        $p->syncFromSave(['coins' => 100, 'crew' => ['ch0' => [['uid' => 'a'], ['uid' => 'b']], 'ch1' => [['uid' => 'c']]], 'staff' => []]);
        $this->assertSame(3, $p->staff_count);
        $p->syncFromSave(['coins' => 100, 'crew' => ['ch0' => [], 'ch1' => [['uid' => 'c']]], 'staff' => ['old', 'stale']]);
        $this->assertSame(1, $p->staff_count);
    }

    public function test_presence_updates_without_a_completed_shift_or_save(): void
    {
        [$p] = MamaputPlayer::issue('Ada');
        $p->user_id = User::factory()->create()->id;
        $p->last_seen_at = now()->subHour();
        $p->save();
        $token = $p->newToken();
        $this->getJson('/api/mamaput/me', ['Authorization' => 'Bearer '.$token])->assertOk();
        $this->assertTrue($p->fresh()->last_seen_at->gt(now()->subSeconds(5)));
        $this->assertSame(0, $p->shifts()->count());
    }

    public function test_admin_stats_and_table_refresh_from_new_database_values(): void
    {
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $this->actingAs($admin);
        Filament::setCurrentPanel(array_values(Filament::getPanels())[0]);
        $widget = Livewire::test(MamaputStatsOverview::class)->assertSee('Hired workers');
        [$p] = MamaputPlayer::issue('Ada');
        $p->staff_count = 37;
        $p->save();
        $widget->call('$refresh')->assertSee('37')->assertSee('10s');
        Livewire::test(ManageMamaputPlayers::class)->assertCanSeeTableRecords([$p]);
    }
}
