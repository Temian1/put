<?php

namespace App\Filament\Resources\MamaputAnnouncements;

use App\Filament\NavigationGroup;
use App\Filament\Resources\MamaputAnnouncements\Pages\ManageMamaputAnnouncements;
use App\Models\MamaputAnnouncement;
use BackedEnum;
use Filament\Actions\ActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use UnitEnum;

/**
 * Announcements to players' in-game inboxes, optionally with coins to claim
 * and an email copy.
 */
class MamaputAnnouncementResource extends Resource
{
    protected static ?string $model = MamaputAnnouncement::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedMegaphone;

    protected static string|UnitEnum|null $navigationGroup = NavigationGroup::MamaPut;

    protected static ?string $navigationLabel = 'Announcements';

    protected static ?string $modelLabel = 'announcement';

    protected static ?int $navigationSort = 3;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('title')->required()->maxLength(100),
            Textarea::make('body')->label('Message')->required()->rows(5)->maxLength(1000),
            Select::make('audience')->options(MamaputAnnouncement::AUDIENCES)->default('all')->required()->live(),
            Select::make('player_id')->label('Player')->required()
                ->relationship('player', 'name')->searchable()
                ->visible(fn (Get $get): bool => $get('audience') === 'player'),
            TextInput::make('reward_coins')->label('Coins to claim (0 for none)')->integer()
                ->minValue(0)->maxValue(100000)->default(0),
            Toggle::make('email')->label('Also email players who have an email address')->default(false),
        ])->columns(1);
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make()->columns(3)->schema([
                TextEntry::make('title')->columnSpanFull(),
                TextEntry::make('body')->label('Message')->columnSpanFull(),
                TextEntry::make('audience')->formatStateUsing(fn (string $state): string => MamaputAnnouncement::AUDIENCES[$state] ?? $state),
                TextEntry::make('player.name')->label('Player')->placeholder('—'),
                TextEntry::make('reward_coins')->label('Coins'),
                TextEntry::make('sent_count')->label('Inboxes'),
                TextEntry::make('claimed')->label('Claimed')
                    ->state(fn (MamaputAnnouncement $a): int => $a->notifications()->whereNotNull('claimed_at')->count()),
                TextEntry::make('opened')->label('Opened')
                    ->state(fn (MamaputAnnouncement $a): int => $a->notifications()->whereNotNull('read_at')->count()),
                TextEntry::make('author.name')->label('Sent by')->placeholder('—'),
                TextEntry::make('created_at')->label('Sent')->since(),
            ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('title')->weight('bold')->searchable()
                    ->description(fn (MamaputAnnouncement $a): string => (string) str($a->body)->limit(70)),
                TextColumn::make('audience')->badge()
                    ->formatStateUsing(fn (string $state): string => MamaputAnnouncement::AUDIENCES[$state] ?? $state),
                TextColumn::make('reward_coins')->label('Coins'),
                TextColumn::make('sent_count')->label('Inboxes'),
                IconColumn::make('emailed')->label('Emailed')->boolean(),
                TextColumn::make('created_at')->label('Sent')->since()->sortable(),
            ])
            ->recordActions([
                ActionGroup::make([
                    ViewAction::make(),
                    DeleteAction::make()
                        ->modalDescription('Removes it from every inbox. Coins already claimed stay with the players.'),
                ])->label('Actions')->icon(Heroicon::OutlinedChevronDown)->button()->size('sm'),
            ]);
    }

    public static function getPages(): array
    {
        return ['index' => ManageMamaputAnnouncements::route('/')];
    }
}
