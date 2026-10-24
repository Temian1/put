<?php

namespace App\Filament\Resources\MamaputPlayers;

use App\Filament\NavigationGroup;
use App\Filament\Resources\MamaputPlayers\Pages\ManageMamaputPlayers;
use App\MamaputAccounts;
use App\MamaputConfig;
use App\Models\MamaputPlayer;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\CodeEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

/**
 * Mama Put Rush players: progress, money, reputation, bans and resets.
 */
class MamaputPlayerResource extends Resource
{
    protected static ?string $model = MamaputPlayer::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedUserGroup;

    protected static string|UnitEnum|null $navigationGroup = NavigationGroup::MamaPut;

    protected static ?string $navigationLabel = 'Players';

    protected static ?string $modelLabel = 'Mama Put player';

    protected static ?int $navigationSort = 1;

    protected static ?string $recordTitleAttribute = 'name';

    public const SOURCES = ['guest' => 'Guest', 'kikter' => 'Kikter account', 'lagoslife' => 'Lagos Life', 'both' => 'Kikter + Lagos Life'];

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Player')->columns(2)->schema([
                TextInput::make('name')->required()->minLength(2)->maxLength(30),
                Select::make('user_id')->label('Linked Kikter account')
                    ->relationship('user', 'name')->searchable()->preload()->nullable(),
            ]),
            Section::make('Progress (written into the cloud save)')
                ->description('The game applies these on its next sync: money, reputation and the furthest level unlocked.')
                ->columns(3)->schema([
                    TextInput::make('coins')->label('Cash (₦)')->integer()->minValue(0)->maxValue(1_000_000_000)->required(),
                    TextInput::make('reputation')->numeric()->minValue(0)->maxValue(100)->required(),
                    TextInput::make('unlocked')->label('Unlocked up to level')->integer()->minValue(1)->maxValue(101)->required(),
                ]),
        ]);
    }

    public static function infolist(Schema $schema): Schema
    {
        $naira = fn ($state): string => '₦'.number_format((int) $state);

        return $schema->components([
            Section::make('Business')->columns(4)->schema([
                TextEntry::make('name'),
                TextEntry::make('tier')->label('Business level')
                    ->formatStateUsing(fn ($state): string => MamaputConfig::TIERS[$state][0] ?? '—'),
                TextEntry::make('lifetime_sales')->label('Lifetime sales')->formatStateUsing($naira),
                TextEntry::make('coins')->label('Cash')->formatStateUsing($naira),
                TextEntry::make('reputation')->numeric(1),
                TextEntry::make('unlocked')->label('Level unlocked'),
                TextEntry::make('stars'),
                TextEntry::make('endless_best')->label('Endless best')->formatStateUsing($naira),
                TextEntry::make('restaurants'),
                TextEntry::make('staff_count')->label('Staff'),
                TextEntry::make('shifts_played')->label('Shifts'),
                TextEntry::make('last_seen_at')->label('Last seen')->since(),
            ]),
            Section::make('Sign-in and wallet')->columns(4)->schema([
                TextEntry::make('source')->label('Signs in with')->badge()
                    ->state(fn (MamaputPlayer $r): string => self::SOURCES[$r->source()]),
                TextEntry::make('user.email')->label('Kikter account')->placeholder('—'),
                TextEntry::make('vatarPlayer.name')->label('Lagos Life player')->placeholder('—'),
                TextEntry::make('wallet_coins')->label('Coin wallet')
                    ->state(fn (MamaputPlayer $r): string => number_format(MamaputAccounts::balance($r)).' coins'),
            ]),
            Section::make('Cloud save')->collapsed()->schema([
                CodeEntry::make('save')->hiddenLabel()
                    ->state(fn (MamaputPlayer $record): string => json_encode($record->save, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) ?: '{}'),
            ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        $naira = fn ($state): string => '₦'.number_format((int) $state);

        return $table
            ->defaultSort('lifetime_sales', 'desc')
            ->columns([
                TextColumn::make('name')->searchable()->weight('bold')
                    ->description(fn (MamaputPlayer $r): ?string => $r->user?->email),
                TextColumn::make('source')->label('Sign-in')->badge()
                    ->state(fn (MamaputPlayer $r): string => self::SOURCES[$r->source()])
                    ->color(fn (MamaputPlayer $r): string => match ($r->source()) {
                        'guest' => 'gray', 'lagoslife' => 'success', default => 'primary',
                    }),
                TextColumn::make('tier')->label('Business')->badge()->color('info')
                    ->formatStateUsing(fn ($state): string => MamaputConfig::TIERS[$state][0] ?? '—'),
                TextColumn::make('unlocked')->label('Level')->sortable(),
                TextColumn::make('lifetime_sales')->label('Sales')->formatStateUsing($naira)->sortable(),
                TextColumn::make('coins')->label('Cash')->formatStateUsing($naira)->sortable(),
                TextColumn::make('reputation')->numeric(1)->sortable(),
                TextColumn::make('stars')->sortable()->toggleable(),
                TextColumn::make('restaurants')->sortable()->toggleable(),
                TextColumn::make('staff_count')->label('Staff')->sortable()->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('shifts_played')->label('Shifts')->sortable(),
                IconColumn::make('banned_at')->label('Banned')->boolean()
                    ->state(fn (MamaputPlayer $r): bool => $r->isBanned()),
                TextColumn::make('last_seen_at')->label('Last seen')->since()->sortable(),
            ])
            ->filters([
                TernaryFilter::make('banned')->label('Banned')
                    ->queries(
                        true: fn (Builder $q) => $q->whereNotNull('banned_at'),
                        false: fn (Builder $q) => $q->whereNull('banned_at'),
                    ),
                Filter::make('active')->label('Active in the last 24h')
                    ->query(fn (Builder $q) => $q->where('last_seen_at', '>=', now()->subDay())),
                SelectFilter::make('source')->label('Sign-in')->options(self::SOURCES)
                    ->query(fn (Builder $q, array $data) => match ($data['value'] ?? null) {
                        'guest' => $q->whereNull('user_id')->whereNull('vatar_player_id'),
                        'kikter' => $q->whereNotNull('user_id')->whereNull('vatar_player_id'),
                        'lagoslife' => $q->whereNull('user_id')->whereNotNull('vatar_player_id'),
                        'both' => $q->whereNotNull('user_id')->whereNotNull('vatar_player_id'),
                        default => $q,
                    }),
                SelectFilter::make('tier')->label('Business level')
                    ->options(collect(MamaputConfig::TIERS)->mapWithKeys(fn (array $t, int $i): array => [$i => $t[0]])),
            ])
            ->recordActions([
                ViewAction::make(),
                EditAction::make()
                    ->using(function (Model $record, array $data): Model {
                        /** @var MamaputPlayer $record */
                        $record->fill(['name' => $data['name'], 'user_id' => $data['user_id'] ?? null]);
                        $record->applyAdminChanges([
                            'coins' => (int) $data['coins'],
                            'reputation' => (float) $data['reputation'],
                            'unlocked' => (int) $data['unlocked'],
                        ]);
                        $record->save();

                        return $record;
                    }),
                Action::make('ban')
                    ->label(fn (MamaputPlayer $r): string => $r->isBanned() ? 'Unban' : 'Ban')
                    ->icon(Heroicon::OutlinedNoSymbol)
                    ->color(fn (MamaputPlayer $r): string => $r->isBanned() ? 'success' : 'danger')
                    ->requiresConfirmation()
                    ->action(function (MamaputPlayer $r): void {
                        $r->banned_at = $r->isBanned() ? null : now();
                        $r->save();
                        Notification::make()->title($r->isBanned() ? 'Player banned' : 'Player unbanned')->success()->send();
                    }),
                Action::make('coins')
                    ->label('Adjust coins')
                    ->icon(Heroicon::OutlinedCircleStack)
                    ->visible(fn (MamaputPlayer $r): bool => $r->source() !== 'guest')
                    ->schema([
                        TextInput::make('amount')->label('Coins to add (negative to take away)')->integer()->required()
                            ->minValue(-1_000_000)->maxValue(1_000_000),
                    ])
                    ->action(function (MamaputPlayer $r, array $data): void {
                        $balance = MamaputAccounts::credit($r, (int) $data['amount'], 'admin', auth()->user()?->email);
                        Notification::make()->title('Wallet now '.number_format($balance).' coins')->success()->send();
                    }),
                Action::make('reset')
                    ->label('Reset progress')
                    ->icon(Heroicon::OutlinedArrowPath)
                    ->color('warning')
                    ->requiresConfirmation()
                    ->modalDescription('Wipes the cloud save. The game starts this player again at level 1 with the starting cash on its next sync.')
                    ->action(function (MamaputPlayer $r): void {
                        $r->save = ['coins' => (int) MamaputConfig::get('start_cash'), 'unlocked' => 1, 'reputation' => 50,
                            'reset' => true, 'updatedAt' => (int) (microtime(true) * 1000) + 60000];
                        $r->syncFromSave($r->save);
                        $r->save_version++;
                        $r->save();
                        Notification::make()->title('Progress reset')->success()->send();
                    }),
                DeleteAction::make(),
            ]);
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function getPages(): array
    {
        return ['index' => ManageMamaputPlayers::route('/')];
    }
}
