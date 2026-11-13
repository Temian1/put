<?php

namespace App\Filament\Widgets;

use App\MamaputConfig;
use App\Models\MamaputPlayer;
use App\Models\MamaputShift;
use Filament\Support\Icons\Heroicon;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class MamaputStatsOverview extends StatsOverviewWidget
{
    protected static ?int $sort = 2;

    protected ?string $pollingInterval = '10s';

    protected ?string $heading = 'Mama Put Rush';

    protected function getStats(): array
    {
        $start = now('Africa/Lagos')->startOfDay()->utc();
        $end = $start->copy()->addDay();
        $today = MamaputShift::where('created_at', '>=', $start)->where('created_at', '<', $end);
        $maintenance = (bool) MamaputConfig::get('maintenance');

        return [
            Stat::make('Mama Put players', number_format(MamaputPlayer::count()))
                ->description(MamaputPlayer::where('last_seen_at', '>=', now()->subDay())->count().' active in the last 24h')
                ->descriptionIcon(Heroicon::ArrowTrendingUp)
                ->color('success'),
            Stat::make('Shifts today', number_format((clone $today)->count()))
                ->description((clone $today)->where('won', true)->count().' won · '.MamaputShift::where('flagged', true)->count().' flagged')
                ->color('info'),
            Stat::make('Sales today', '₦'.number_format((int) (clone $today)->sum('sales')))
                ->description('Lifetime ₦'.number_format((int) MamaputPlayer::sum('lifetime_sales')))
                ->color('warning'),
            Stat::make('Game status', $maintenance ? 'Maintenance' : 'Live')
                ->description(MamaputPlayer::whereNotNull('banned_at')->count().' banned players')
                ->color($maintenance ? 'danger' : 'success'),
            Stat::make('Online now', number_format(MamaputPlayer::whereNull('banned_at')->where('last_seen_at', '>=', now()->subMinutes(2))->count()))
                ->description('Seen in the last 2 minutes · refreshes every 10s')
                ->color('success'),
            Stat::make('Hired workers', number_format((int) MamaputPlayer::sum('staff_count')))
                ->description('Current crews across all restaurants')
                ->color('info'),
        ];
    }
}
