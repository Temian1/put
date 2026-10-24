<?php

namespace App\Filament\Resources\MamaputShifts;

use App\Filament\NavigationGroup;
use App\Filament\Resources\MamaputShifts\Pages\ManageMamaputShifts;
use App\Models\MamaputShift;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use UnitEnum;

/**
 * Every shift the game reports. Suspicious ones are flagged for review.
 */
class MamaputShiftResource extends Resource
{
    protected static ?string $model = MamaputShift::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedClipboardDocumentList;

    protected static string|UnitEnum|null $navigationGroup = NavigationGroup::MamaPut;

    protected static ?string $navigationLabel = 'Shifts';

    protected static ?string $modelLabel = 'Mama Put shift';

    protected static ?int $navigationSort = 2;

    public static function getNavigationBadge(): ?string
    {
        $flagged = MamaputShift::where('flagged', true)->count();

        return $flagged ? (string) $flagged : null;
    }

    public static function table(Table $table): Table
    {
        $naira = fn ($state): string => '₦'.number_format((int) $state);

        return $table
            ->modifyQueryUsing(fn ($query) => $query->with('player:id,name'))
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('player.name')->label('Player')->searchable()->weight('bold'),
                TextColumn::make('mode')->badge(),
                TextColumn::make('level')->sortable(),
                IconColumn::make('won')->boolean(),
                TextColumn::make('served')->sortable(),
                TextColumn::make('lost')->sortable()->toggleable(),
                TextColumn::make('sales')->formatStateUsing($naira)->sortable(),
                TextColumn::make('cash')->label('Cash in hand')->formatStateUsing($naira)->sortable(),
                TextColumn::make('stars'),
                TextColumn::make('duration')->suffix(' s')->toggleable(isToggledHiddenByDefault: true),
                IconColumn::make('flagged')->boolean()->trueColor('danger'),
                TextColumn::make('created_at')->label('Played')->since()->sortable(),
            ])
            ->filters([
                TernaryFilter::make('flagged'),
                TernaryFilter::make('won'),
                SelectFilter::make('mode')->options(['level' => 'Level', 'daily' => 'Daily', 'endless' => 'Endless']),
            ])
            ->recordActions([
                Action::make('flag')
                    ->label(fn (MamaputShift $r): string => $r->flagged ? 'Clear flag' : 'Flag')
                    ->icon(Heroicon::OutlinedFlag)
                    ->action(fn (MamaputShift $r) => $r->update(['flagged' => ! $r->flagged])),
                DeleteAction::make(),
            ]);
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function getPages(): array
    {
        return ['index' => ManageMamaputShifts::route('/')];
    }
}
