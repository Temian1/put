<?php

namespace App\Filament\Resources\MamaputAirtime;

use App\Filament\NavigationGroup;
use App\Filament\Resources\MamaputAirtime\Pages\ManageMamaputAirtime;
use App\MamaputAirtime;
use App\Models\MamaputAirtimeEntry;
use App\Models\User;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Actions\BulkAction;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use UnitEnum;

/**
 * Phone numbers players left for the airtime draw. Winners are picked at
 * random from players who reached the draw level, then marked as sent.
 */
class MamaputAirtimeResource extends Resource
{
    protected static ?string $model = MamaputAirtimeEntry::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedDevicePhoneMobile;

    protected static string|UnitEnum|null $navigationGroup = NavigationGroup::MamaPut;

    protected static ?string $navigationLabel = 'Airtime rewards';

    protected static ?string $modelLabel = 'airtime entry';

    protected static ?string $pluralModelLabel = 'airtime entries';

    protected static ?int $navigationSort = 5;

    protected static ?string $slug = 'mamaput-airtime';

    public static function getNavigationBadge(): ?string
    {
        $picked = MamaputAirtimeEntry::where('status', 'picked')->count();

        return $picked ? (string) $picked : null;
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Picked to win, airtime not sent yet';
    }

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query) => $query->with('player'))
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('player.name')->label('Player')->searchable()->weight('bold')->placeholder('Deleted player'),
                TextColumn::make('phone')->searchable()->copyable()->copyMessage('Number copied')->fontFamily('mono'),
                TextColumn::make('network')->badge()
                    ->formatStateUsing(fn (string $state): string => MamaputAirtime::NETWORKS[$state] ?? $state)
                    ->color(fn (string $state): string => match ($state) {
                        'mtn' => 'warning', 'airtel' => 'danger', 'glo' => 'success', default => 'gray',
                    })
                    ->description(fn (MamaputAirtimeEntry $e): ?string => $e->detected && $e->detected !== $e->network
                        ? 'Prefix looks like '.(MamaputAirtime::NETWORKS[$e->detected] ?? $e->detected) : null),
                TextColumn::make('player.unlocked')->label('Level')->sortable()->badge()
                    ->color(fn (MamaputAirtimeEntry $e): string => $e->eligible() ? 'success' : 'gray')
                    ->tooltip(fn (MamaputAirtimeEntry $e): string => $e->eligible()
                        ? 'Reached level '.MamaputAirtime::LEVEL.': in the draw'
                        : 'Not at level '.MamaputAirtime::LEVEL.' yet'),
                TextColumn::make('status')->badge()
                    ->formatStateUsing(fn (string $state): string => MamaputAirtimeEntry::STATUSES[$state] ?? $state)
                    ->color(fn (string $state): string => match ($state) {
                        'picked' => 'warning', 'sent' => 'success', 'rejected' => 'danger', default => 'gray',
                    }),
                TextColumn::make('created_at')->label('Added')->since()->sortable(),
                TextColumn::make('handled_at')->label('Handled')->since()->placeholder('—')->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('status')->options(MamaputAirtimeEntry::STATUSES),
                SelectFilter::make('network')->options(MamaputAirtime::NETWORKS),
                TernaryFilter::make('eligible')->label('Reached level '.MamaputAirtime::LEVEL)
                    ->queries(
                        true: fn (Builder $query) => $query->whereHas('player', fn (Builder $p) => $p->where('unlocked', '>=', MamaputAirtime::LEVEL)),
                        false: fn (Builder $query) => $query->whereHas('player', fn (Builder $p) => $p->where('unlocked', '<', MamaputAirtime::LEVEL)),
                    ),
            ])
            ->recordActions([
                ActionGroup::make([
                    Action::make('markSent')
                        ->label('Mark as sent')
                        ->icon(Heroicon::OutlinedCheckCircle)
                        ->color('success')
                        ->visible(fn (MamaputAirtimeEntry $e): bool => $e->isOpen())
                        ->requiresConfirmation()
                        ->modalDescription(fn (MamaputAirtimeEntry $e): string => "Only after sending the airtime to {$e->phone}. The player gets a message in the game.")
                        ->action(function (MamaputAirtimeEntry $e): void {
                            $e->mark('sent', self::admin());
                            Notification::make()->title('Marked as sent')->success()->send();
                        }),
                    Action::make('reject')
                        ->label('Reject')
                        ->icon(Heroicon::OutlinedXCircle)
                        ->color('danger')
                        ->visible(fn (MamaputAirtimeEntry $e): bool => $e->isOpen())
                        ->requiresConfirmation()
                        ->action(function (MamaputAirtimeEntry $e): void {
                            $e->mark('rejected', self::admin());
                            Notification::make()->title('Rejected')->success()->send();
                        }),
                    Action::make('reopen')
                        ->label('Back to waiting')
                        ->icon(Heroicon::OutlinedArrowPath)
                        ->visible(fn (MamaputAirtimeEntry $e): bool => ! $e->isOpen())
                        ->requiresConfirmation()
                        ->action(function (MamaputAirtimeEntry $e): void {
                            $e->forceFill(['status' => 'pending', 'handled_by' => null, 'handled_at' => null])->save();
                            Notification::make()->title('Back to waiting')->success()->send();
                        }),
                    DeleteAction::make(),
                ])->label('Actions')->icon(Heroicon::OutlinedChevronDown)->button()->size('sm'),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    BulkAction::make('markSent')
                        ->label('Mark selected as sent')
                        ->icon(Heroicon::OutlinedCheckCircle)
                        ->color('success')
                        ->requiresConfirmation()
                        ->deselectRecordsAfterCompletion()
                        ->action(fn (Collection $records) => self::markMany($records, 'sent')),
                    BulkAction::make('reject')
                        ->label('Reject selected')
                        ->icon(Heroicon::OutlinedXCircle)
                        ->color('danger')
                        ->requiresConfirmation()
                        ->deselectRecordsAfterCompletion()
                        ->action(fn (Collection $records) => self::markMany($records, 'rejected')),
                ]),
            ]);
    }

    private static function markMany(Collection $records, string $status): void
    {
        $open = $records->filter(fn (MamaputAirtimeEntry $e): bool => $e->isOpen());
        $open->each(fn (MamaputAirtimeEntry $e) => $e->mark($status, self::admin()));
        $skipped = $records->count() - $open->count();
        Notification::make()->title($open->count().' '.($status === 'sent' ? 'marked as sent' : 'rejected'))
            ->body($skipped ? "{$skipped} already handled, left as they were." : null)->success()->send();
    }

    private static function admin(): ?User
    {
        $user = auth()->user();

        return $user instanceof User ? $user : null;
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function getPages(): array
    {
        return ['index' => ManageMamaputAirtime::route('/')];
    }
}
