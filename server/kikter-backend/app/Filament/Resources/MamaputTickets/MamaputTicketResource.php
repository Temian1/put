<?php

namespace App\Filament\Resources\MamaputTickets;

use App\Filament\Actions\EmailPlayers;
use App\Filament\NavigationGroup;
use App\Filament\Resources\MamaputTickets\Pages\ManageMamaputTickets;
use App\Models\MamaputTicket;
use App\Models\MamaputTicketMessage;
use App\Models\User;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Actions\BulkAction;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Toggle;
use Filament\Infolists\Components\RepeatableEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use UnitEnum;

/**
 * Requests and complaints players send from the game. Replies show in the
 * game's support screen and can also go by email.
 */
class MamaputTicketResource extends Resource
{
    protected static ?string $model = MamaputTicket::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedLifebuoy;

    protected static string|UnitEnum|null $navigationGroup = NavigationGroup::MamaPut;

    protected static ?string $navigationLabel = 'Support';

    protected static ?string $modelLabel = 'support ticket';

    protected static ?int $navigationSort = 2;

    public static function getNavigationBadge(): ?string
    {
        $open = MamaputTicket::where('status', 'open')->count();

        return $open ? (string) $open : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'danger';
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Tickets waiting for a reply';
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Ticket')->columns(4)->schema([
                TextEntry::make('player.name')->label('Player'),
                TextEntry::make('email')->label('Email')->placeholder('None')
                    ->state(fn (MamaputTicket $t): ?string => $t->player?->email()),
                TextEntry::make('category')->badge()
                    ->formatStateUsing(fn (string $state): string => MamaputTicket::CATEGORIES[$state] ?? $state),
                TextEntry::make('status')->badge()->color(fn (string $state): string => self::statusColor($state))
                    ->formatStateUsing(fn (string $state): string => MamaputTicket::STATUSES[$state] ?? $state),
            ]),
            Section::make('Conversation')->schema([
                RepeatableEntry::make('messages')->hiddenLabel()->contained(false)->schema([
                    TextEntry::make('body')->weight('medium')
                        ->label(fn (MamaputTicketMessage $record): string => ($record->from_support ? 'Support' : 'Player').' · '.$record->created_at?->diffForHumans()),
                ]),
            ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query) => $query->with(['player.user', 'player.vatarPlayer.user', 'messages']))
            ->defaultSort('updated_at', 'desc')
            ->columns([
                TextColumn::make('player.name')->label('Player')->searchable()->weight('bold')
                    ->description(fn (MamaputTicket $t): ?string => $t->player?->email()),
                TextColumn::make('category')->badge()
                    ->formatStateUsing(fn (string $state): string => MamaputTicket::CATEGORIES[$state] ?? $state),
                TextColumn::make('preview')->label('Message')->wrap()
                    ->state(fn (MamaputTicket $t): string => $t->preview()),
                TextColumn::make('status')->badge()->color(fn (string $state): string => self::statusColor($state))
                    ->formatStateUsing(fn (string $state): string => MamaputTicket::STATUSES[$state] ?? $state),
                TextColumn::make('updated_at')->label('Last activity')->since()->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')->options(MamaputTicket::STATUSES),
                SelectFilter::make('category')->options(MamaputTicket::CATEGORIES),
            ])
            ->recordActions([
                ActionGroup::make([
                    ViewAction::make(),
                    Action::make('reply')
                        ->label('Reply')
                        ->icon(Heroicon::OutlinedChatBubbleLeftRight)
                        ->color('primary')
                        ->modalDescription(fn (MamaputTicket $t): string => $t->messages->last()?->body ?? '')
                        ->modalSubmitActionLabel('Send reply')
                        ->schema([
                            Textarea::make('message')->label('Your reply')->required()->rows(6)->maxLength(5000),
                            Toggle::make('notify')->label('Also send it by email')->default(true)
                                ->visible(fn (MamaputTicket $record): bool => $record->player?->email() !== null),
                        ])
                        ->action(function (MamaputTicket $t, array $data): void {
                            /** @var User|null $admin */
                            $admin = auth()->user();
                            $t->addReply($admin, $data['message']);
                            Notification::make()->title('Reply saved. The player sees it in the game.')->success()->send();
                            if ($data['notify'] ?? false) {
                                EmailPlayers::send(
                                    [['email' => $t->player->email(), 'name' => $t->player->name]],
                                    'A reply from Mama Put Rush support', $data['message'], 'Mama Put Rush',
                                );
                            }
                        }),
                    Action::make('close')
                        ->label('Close ticket')
                        ->icon(Heroicon::OutlinedCheckCircle)
                        ->color('success')
                        ->visible(fn (MamaputTicket $t): bool => ! $t->isClosed())
                        ->requiresConfirmation()
                        ->action(function (MamaputTicket $t): void {
                            $t->close();
                            Notification::make()->title('Ticket closed')->success()->send();
                        }),
                    Action::make('reopen')
                        ->label('Reopen ticket')
                        ->icon(Heroicon::OutlinedArrowPath)
                        ->color('warning')
                        ->visible(fn (MamaputTicket $t): bool => $t->isClosed())
                        ->action(function (MamaputTicket $t): void {
                            $t->reopen();
                            Notification::make()->title('Ticket reopened')->success()->send();
                        }),
                    DeleteAction::make(),
                ])->label('Actions')->icon(Heroicon::OutlinedChevronDown)->button()->size('sm'),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    BulkAction::make('close')
                        ->label('Close selected')
                        ->icon(Heroicon::OutlinedCheckCircle)
                        ->requiresConfirmation()
                        ->deselectRecordsAfterCompletion()
                        ->action(function (Collection $records): void {
                            $records->each(fn (MamaputTicket $t) => $t->close());
                            Notification::make()->title($records->count().' closed')->success()->send();
                        }),
                ]),
            ]);
    }

    private static function statusColor(string $status): string
    {
        return match ($status) {
            'open' => 'danger', 'answered' => 'success', default => 'gray',
        };
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function getPages(): array
    {
        return ['index' => ManageMamaputTickets::route('/')];
    }
}
