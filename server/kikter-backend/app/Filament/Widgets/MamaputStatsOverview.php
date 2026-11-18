<?php

namespace App\Filament\Widgets;

use App\MamaputAirtime;
use App\MamaputConfig;
use App\Models\MamaputAirtimeEntry;
use App\Models\MamaputPlayer;
use App\Models\MamaputShift;
use Filament\Support\Icons\Heroicon;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Database\Eloquent\Builder;

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
        $airtime = fn (?string $status = null) => MamaputAirtimeEntry::query()->when($status, fn (Builder $q) => $q->where('status', $status));
        // An email from a linked account, or one the player typed in the game.
        $accountEmail = fn (Builder $q) => $q->whereHas('user', fn (Builder $u) => $u->whereNotNull('email'))
            ->orWhereHas('vatarPlayer.user', fn (Builder $u) => $u->whereNotNull('email'));
        $withAccountEmail = MamaputPlayer::where($accountEmail)->count();
        $typedOnly = MamaputPlayer::whereNotNull('contact_email')->whereNot($accountEmail)->count();

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
            Stat::make('Airtime numbers', number_format($airtime()->count()))
                ->description(number_format($airtime()->whereHas('player', fn (Builder $p) => $p->where('unlocked', '>=', MamaputAirtime::LEVEL))->count())
                    .' reached level '.MamaputAirtime::LEVEL.' · '.number_format($airtime('picked')->count()).' picked, not sent')
                ->descriptionIcon(Heroicon::DevicePhoneMobile)
                ->color('warning'),
            Stat::make('Airtime rewarded', number_format($airtime('sent')->count()))
                ->description(number_format($airtime('rejected')->count()).' rejected')
                ->descriptionIcon(Heroicon::CheckBadge)
                ->color('success'),
            Stat::make('Players with email', number_format($withAccountEmail + $typedOnly))
                ->description(number_format($withAccountEmail).' from accounts · '.number_format($typedOnly).' typed in the game')
                ->descriptionIcon(Heroicon::Envelope)
                ->color('info'),
        ];
    }
}
