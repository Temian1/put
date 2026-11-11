<?php

namespace App\Filament\Resources\MamaputMessages;

use App\Filament\NavigationGroup;
use App\Filament\Resources\MamaputMessages\Pages\ManageMamaputMessages;
use App\Models\MamaputNotification;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use UnitEnum;

/**
 * Short messages players send each other after passing on a leaderboard, so
 * admins can remove abuse and ban the sender.
 */
class MamaputMessageResource extends Resource
{
    protected static ?string $model = MamaputNotification::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedChatBubbleOvalLeftEllipsis;

    protected static string|UnitEnum|null $navigationGroup = NavigationGroup::MamaPut;

    protected static ?string $navigationLabel = 'Player messages';

    protected static ?string $modelLabel = 'player message';

    protected static ?int $navigationSort = 4;

    protected static ?string $slug = 'mamaput-player-messages';

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('type', 'message');
    }

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query) => $query->with(['fromPlayer', 'player']))
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('fromPlayer.name')->label('From')->searchable()->placeholder('Deleted player'),
                TextColumn::make('player.name')->label('To')->searchable(),
                TextColumn::make('body')->label('Message')->wrap()->searchable(),
                TextColumn::make('created_at')->label('Sent')->since()->sortable(),
            ])
            ->recordActions([
                ActionGroup::make([
                    Action::make('banSender')
                        ->label('Ban sender')
                        ->icon(Heroicon::OutlinedNoSymbol)
                        ->color('danger')
                        ->visible(fn (MamaputNotification $n): bool => $n->fromPlayer !== null && ! $n->fromPlayer->isBanned())
                        ->requiresConfirmation()
                        ->modalDescription('Bans the sender from Mama Put Rush for abusive messages. You can unban them from Players.')
                        ->action(function (MamaputNotification $n): void {
                            $n->fromPlayer->forceFill(['banned_at' => now(), 'ban_reason' => 'Abusive messages'])->save();
                            Notification::make()->title("{$n->fromPlayer->name} has been banned")->danger()->send();
                        }),
                    DeleteAction::make(),
                ])->label('Actions')->icon(Heroicon::OutlinedChevronDown)->button()->size('sm'),
            ])
            ->toolbarActions([
                BulkActionGroup::make([DeleteBulkAction::make()]),
            ]);
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function getPages(): array
    {
        return ['index' => ManageMamaputMessages::route('/')];
    }
}
