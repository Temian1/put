<?php

namespace App\Filament\Resources\MamaputWalletLogs;

use App\Filament\NavigationGroup;
use App\Filament\Resources\MamaputWalletLogs\Pages\ManageMamaputWalletLogs;
use App\Models\MamaputWalletLog;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use UnitEnum;

/**
 * The Mama Put coin ledger: rewards, swaps for naira, Lagos Life purchases
 * and admin adjustments. Read-only; adjust coins from the Players page.
 */
class MamaputWalletLogResource extends Resource
{
    protected static ?string $model = MamaputWalletLog::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCircleStack;

    protected static string|UnitEnum|null $navigationGroup = NavigationGroup::MamaPut;

    protected static ?string $navigationLabel = 'Coin ledger';

    protected static ?string $modelLabel = 'coin change';

    protected static ?int $navigationSort = 4;

    public const REASONS = [
        'shift' => 'Won shift', 'exchange' => 'Swapped for naira', 'lagoslife_purchase' => 'Lagos Life purchase',
        'linked' => 'Wallets linked', 'admin' => 'Admin adjustment',
    ];

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn ($query) => $query->with(['player:id,name', 'user:id,email']))
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('player.name')->label('Player')->searchable()->weight('bold')
                    ->description(fn (MamaputWalletLog $r): ?string => $r->user?->email),
                TextColumn::make('reason')->badge()->formatStateUsing(fn (string $state): string => self::REASONS[$state] ?? $state),
                TextColumn::make('amount')->numeric()->sortable()
                    ->color(fn (int $state): string => $state < 0 ? 'danger' : 'success'),
                TextColumn::make('balance')->numeric(),
                TextColumn::make('ref')->label('Details')->toggleable(),
                TextColumn::make('created_at')->label('When')->since()->sortable(),
            ])
            ->filters([SelectFilter::make('reason')->options(self::REASONS)]);
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function getPages(): array
    {
        return ['index' => ManageMamaputWalletLogs::route('/')];
    }
}
