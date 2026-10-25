<?php

namespace App\Filament\Pages;

use App\Filament\NavigationGroup;
use App\GameStore;
use App\Models\GameSetting;
use App\Models\VatarSetting;
use BackedEnum;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Tabs;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Illuminate\Validation\ValidationException;
use UnitEnum;

/**
 * Live configuration for both games: maintenance, modes, arenas, rewards and announcements.
 */
class GameSettings extends Page
{
    protected string $view = 'filament.pages.game-settings';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedAdjustmentsHorizontal;

    protected static string|UnitEnum|null $navigationGroup = NavigationGroup::GameControl;

    protected static ?string $title = 'Lagos War settings';

    protected static ?string $navigationLabel = 'Lagos War settings';

    public function getSubheading(): ?string
    {
        return 'Only for Lagos War (Block Battle). Mama Put Rush has its own settings under "Mama Put Rush" in the sidebar.';
    }

    protected static ?int $navigationSort = 1;

    /**
     * @var array<string, mixed>|null
     */
    public ?array $data = [];

    public function mount(): void
    {
        $vatar = VatarSetting::current();
        $this->form->fill(array_merge(GameSetting::values(), [
            'vatar_enabled' => $vatar->enabled, 'vatar_mode' => $vatar->mode,
            'vatar_products' => $vatar->products ?? [],
        ]));
    }

    public function form(Schema $schema): Schema
    {
        $whole = fn (string $name, string $label, int $max = 100000): TextInput => TextInput::make($name)
            ->label($label)->required()->integer()->minValue(0)->maxValue($max)
            ->dehydrateStateUsing(fn (mixed $state): int => (int) $state);

        return $schema
            ->statePath('data')
            ->components([
                Tabs::make('Settings')
                    ->persistTabInQueryString()
                    ->tabs([
                        Tab::make('Lagos Life keys (Lagos War)')
                            ->schema([
                                Section::make('Integration credentials')
                                    ->description('Keys are encrypted in the database. Existing keys are never sent back to the browser. Leave a password field blank to keep its saved value. Embedded game: /vatar/block-battle. Webhook: /api/vatar/webhook.')
                                    ->schema([
                                        Toggle::make('vatar_enabled')->label('Enable Vatar integration'),
                                        Select::make('vatar_mode')->options(['test' => 'Sandbox', 'live' => 'Live'])->required(),
                                        TextInput::make('vatar_secret')->label('API secret')->password()->maxLength(250)
                                            ->rule('regex:/^vtr_(test|live)_[a-zA-Z0-9_-]+$/'),
                                        TextInput::make('vatar_webhook_secret')->label('Webhook signing secret')->password()->maxLength(250)
                                            ->rule('regex:/^vtr_whsec_(test|live)_[a-zA-Z0-9_-]+$/'),
                                        TextInput::make('vatar_results_secret')->label('Match results signing secret')->password()->maxLength(250)
                                            ->rule('regex:/^vtr_rsec_(test|live)_[a-zA-Z0-9_-]+$/'),
                                    ]),
                                Repeater::make('vatar_products')->label('Store product mappings')
                                    ->helperText('Create these same product IDs in the Vatar dashboard as one-off products; Vatar checkout supplies the price. Suits and upgrades are owned once. Per-match items stack, so players can buy them again and again.')
                                    ->maxItems(30)->columns(2)->schema([
                                        TextInput::make('product_id')->required()->maxLength(32)->regex('/^[a-z0-9_-]+$/')->distinct(),
                                        TextInput::make('name')->required()->maxLength(100),
                                        Select::make('type')->options(['skin' => 'Suit (cosmetic)', 'item' => 'Store item (gameplay)'])
                                            ->default('skin')->placeholder('Suit (cosmetic)')->live(),
                                        TextInput::make('skin')->label('Suit color')->regex('/^#[a-fA-F0-9]{6}$/')
                                            ->required(fn (Get $get): bool => $get('type') !== 'item')
                                            ->visible(fn (Get $get): bool => $get('type') !== 'item'),
                                        Select::make('item')->options(collect(GameStore::ITEMS)->map(fn (array $item): string => $item['name'])->all())
                                            ->required(fn (Get $get): bool => $get('type') === 'item')
                                            ->visible(fn (Get $get): bool => $get('type') === 'item'),
                                        TextInput::make('quantity')->label('Matches per purchase')->integer()->minValue(1)->maxValue(100)->default(1)
                                            ->helperText('For per-match items, e.g. 5 = five matches.')
                                            ->visible(fn (Get $get): bool => $get('type') === 'item'),
                                    ]),
                            ]),
                        Tab::make('Live ops')
                            ->icon(Heroicon::OutlinedSignal)
                            ->schema([
                                Section::make('Availability')
                                    ->columns(2)
                                    ->schema([
                                        Toggle::make('maintenance')
                                            ->label('Maintenance mode')
                                            ->helperText('Stops new online matches. Practice keeps working.'),
                                        Toggle::make('registration_open')
                                            ->label('Allow new sign-ups'),
                                    ]),
                                Textarea::make('announcement')
                                    ->label('Announcement banner')
                                    ->helperText('Shown on the game hub and menus. Leave empty to hide it.')
                                    ->maxLength(200)
                                    ->rows(2),
                            ]),
                        Tab::make('Lagos War')
                            ->icon(Heroicon::OutlinedCube)
                            ->schema([
                                Section::make('Modes and arenas')
                                    ->columns(2)
                                    ->schema([
                                        CheckboxList::make('enabled_modes')
                                            ->label('Online modes')
                                            ->options([
                                                'quick' => 'Quick match',
                                                'ranked' => 'Ranked',
                                                'team' => 'Team battle 2v2',
                                                'ffa' => 'Free for all',
                                                'private' => 'Private rooms',
                                                'ctf' => 'Capture the flag',
                                                'chaos' => 'Chaos Apocalypse squads (solo always works)',
                                            ])
                                            ->required()
                                            ->minItems(1),
                                        CheckboxList::make('enabled_maps')
                                            ->label('Arenas')
                                            ->options([
                                                'eko' => 'Eko Night',
                                                'maze' => 'Lagoon Maze',
                                                'bridge' => 'Third Mainland Bridge',
                                                'market' => 'Balogun Market',
                                                'beach' => 'Lekki Beach',
                                            ])
                                            ->required()
                                            ->minItems(1),
                                    ]),
                                Section::make('Rewards and rating')
                                    ->columns(3)
                                    ->schema([
                                        $whole('xp_per_match', 'XP per match', 1000),
                                        $whole('xp_per_win', 'Extra XP per win', 1000),
                                        $whole('xp_block_bonus_cap', 'Max XP from blocks', 1000),
                                        $whole('ranked_k_factor', 'Ranked K-factor', 64),
                                        $whole('mission_reward_xp', 'Daily mission reward XP', 5000),
                                        $whole('chaos_xp_per_stage', 'Chaos XP per stage reached', 200),
                                    ]),
                                Section::make('Coin matches')
                                    ->description('Standalone players can stake Lagos War coins on 1v1 quick matches: the winner takes the pot minus 5%, a draw refunds both. Coins cannot be cashed out. Lagos Life players stake through Lagos Life instead.')
                                    ->columns(2)
                                    ->schema([
                                        Toggle::make('coin_stakes_enabled')->label('Allow coin stakes'),
                                        $whole('daily_reward_coins', 'Coins in the daily gift', 10000),
                                    ]),
                            ]),
                        Tab::make('Slasher')
                            ->icon(Heroicon::OutlinedScissors)
                            ->schema([
                                Toggle::make('slasher_enabled')
                                    ->label('Slasher online duels')
                                    ->helperText('Practice against the bot stays available.'),
                                Section::make('Rewards')
                                    ->columns(2)
                                    ->schema([
                                        $whole('slasher_xp_per_match', 'XP per duel', 1000),
                                        $whole('slasher_xp_per_win', 'Extra XP per win', 1000),
                                    ]),
                            ]),
                        Tab::make('Social')
                            ->icon(Heroicon::OutlinedChatBubbleLeftRight)
                            ->schema([
                                Section::make('Lagos War community features')
                                    ->description('Changes apply to matches that start after saving.')
                                    ->columns(3)
                                    ->schema([
                                        Toggle::make('chat_enabled')
                                            ->label('Live text chat')
                                            ->helperText('Filtered, rate-limited match chat.'),
                                        Toggle::make('voice_enabled')
                                            ->label('Voice chat')
                                            ->helperText('Peer-to-peer; teammates only in 2v2.'),
                                        Toggle::make('spectating_enabled')
                                            ->label('Watch live matches')
                                            ->helperText('Spectators never send inputs or earn rewards.'),
                                    ]),
                            ]),
                        Tab::make('Music')
                            ->icon(Heroicon::OutlinedMusicalNote)
                            ->schema([
                                Section::make('Soundtrack')
                                    ->description('Upload MP3, OGG, M4A or WAV files (up to 15 MB). Leave a slot empty to keep the built-in music. Players can still switch music off.')
                                    ->columns(2)
                                    ->schema([
                                        FileUpload::make('music_menu')
                                            ->label('Menu and lobby music')
                                            ->disk('public')->directory('music')->visibility('public')
                                            ->acceptedFileTypes(['audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav'])
                                            ->maxSize(15360),
                                        FileUpload::make('music_battle')
                                            ->label('In-match music')
                                            ->disk('public')->directory('music')->visibility('public')
                                            ->acceptedFileTypes(['audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav'])
                                            ->maxSize(15360),
                                    ]),
                            ]),
                        Tab::make('Daily gift')
                            ->icon(Heroicon::OutlinedGift)
                            ->schema([
                                Section::make()
                                    ->description('Players open one gift per Lagos day. Consecutive days multiply the reward up to the cap.')
                                    ->columns(2)
                                    ->schema([
                                        $whole('daily_reward_xp', 'Base XP', 5000),
                                        $whole('daily_streak_cap', 'Streak multiplier cap', 30),
                                    ]),
                            ]),
                    ]),
            ]);
    }

    public function save(): void
    {
        $state = $this->form->getState();
        $vatar = VatarSetting::current();
        $mode = $state['vatar_mode'];
        $keys = [];
        foreach (['secret', 'webhook_secret', 'results_secret'] as $field) {
            $value = $state['vatar_'.$field] ?? null;
            if (filled($value)) {
                $prefix = match ($field) {
                    'secret' => 'vtr_'.$mode.'_',
                    'webhook_secret' => 'vtr_whsec_'.$mode.'_',
                    'results_secret' => 'vtr_rsec_'.$mode.'_',
                };
                if (! str_starts_with($value, $prefix)) {
                    throw ValidationException::withMessages(['data.vatar_'.$field => 'The key must match the selected mode.']);
                }
                $keys[$field] = $value;
            }
        }
        if ($vatar->mode !== $mode && count($keys) !== 3) {
            throw ValidationException::withMessages(['data.vatar_mode' => 'Supply all three keys when changing mode.']);
        }
        if ($state['vatar_enabled']) {
            foreach (['secret', 'webhook_secret', 'results_secret'] as $field) {
                if (! filled($keys[$field] ?? $vatar->{$field})) {
                    throw ValidationException::withMessages(['data.vatar_'.$field => 'Supply this key before enabling the integration.']);
                }
            }
        }
        $vatar->update(array_merge($keys, [
            'mode' => $mode, 'enabled' => (bool) $state['vatar_enabled'], 'products' => $state['vatar_products'] ?? [],
        ]));
        GameSetting::store($state);
        foreach (['secret', 'webhook_secret', 'results_secret'] as $field) {
            $this->data['vatar_'.$field] = null;
        }

        Notification::make()
            ->title('Settings saved')
            ->body('Players see the changes on their next page load or match.')
            ->success()
            ->send();
    }
}
