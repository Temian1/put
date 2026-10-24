<?php

namespace App\Filament\Pages;

use App\Filament\NavigationGroup;
use App\MamaputConfig;
use BackedEnum;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Tabs;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use UnitEnum;

/**
 * Live configuration for Mama Put Rush. The game fetches it on start, so
 * changes reach players without a new release.
 */
class MamaputSettings extends Page
{
    protected string $view = 'filament.pages.game-settings';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCog6Tooth;

    protected static string|UnitEnum|null $navigationGroup = NavigationGroup::MamaPut;

    protected static ?string $title = 'Mama Put settings';

    protected static ?string $navigationLabel = 'Settings';

    protected static ?int $navigationSort = 3;

    /** @var array<string, mixed>|null */
    public ?array $data = [];

    public function mount(): void
    {
        $v = MamaputConfig::values();
        $prices = [];
        foreach (MamaputConfig::FOODS as $id => [, $default]) {
            $prices[$id] = $v['food_prices'][$id] ?? $default;
        }
        $costs = $income = [];
        foreach (MamaputConfig::PLACES as $i => [, $cost, $earn]) {
            $costs[$i] = $v['opening_costs'][$i] ?? $cost;
            $income[$i] = $v['branch_income'][$i] ?? $earn;
        }
        $this->form->fill(array_merge($v, [
            'food_prices' => $prices, 'opening_costs' => $costs, 'branch_income' => $income,
        ]));
    }

    public function form(Schema $schema): Schema
    {
        $naira = fn (string $name, string $label, int $max = 100_000_000): TextInput => TextInput::make($name)
            ->label($label)->prefix('₦')->required()->integer()->minValue(0)->maxValue($max)
            ->dehydrateStateUsing(fn (mixed $state): int => (int) $state);
        $factor = fn (string $name, string $label): TextInput => TextInput::make($name)
            ->label($label)->required()->numeric()->minValue(0.1)->maxValue(10)->step(0.05)
            ->helperText('1 = normal, 1.5 = 50% dearer, 0.8 = 20% cheaper')
            ->dehydrateStateUsing(fn (mixed $state): float => (float) $state);

        $foods = [];
        foreach (MamaputConfig::FOODS as $id => [$name]) {
            $foods[] = $naira("food_prices.$id", $name, 100_000);
        }
        $places = [];
        foreach (MamaputConfig::PLACES as $i => [$name]) {
            $places[] = Section::make(($i + 1).'. '.$name)->columns(2)->compact()->schema([
                $naira("opening_costs.$i", 'Opening cost')->disabled($i === 0),
                $naira("branch_income.$i", 'Income per shift once open'),
            ]);
        }

        return $schema
            ->statePath('data')
            ->components([
                Tabs::make('Mama Put')
                    ->persistTabInQueryString()
                    ->tabs([
                        Tab::make('Live ops')->icon(Heroicon::OutlinedSignal)->schema([
                            Section::make('Availability')->columns(2)->schema([
                                Toggle::make('maintenance')->label('Maintenance mode')
                                    ->helperText('Players see a maintenance notice and cannot start shifts.'),
                                Toggle::make('leaderboard_enabled')->label('Show the online leaderboard'),
                            ]),
                            Textarea::make('announcement')->label('Announcement banner')
                                ->helperText('Shown on the game menu. Leave empty to hide it.')->maxLength(200)->rows(2),
                        ]),
                        Tab::make('Economy')->icon(Heroicon::OutlinedBanknotes)->schema([
                            Section::make('Money')->columns(2)->schema([
                                $naira('start_cash', 'Starting cash for new players', 10_000_000),
                                $naira('daily_bonus', 'Daily challenge win bonus', 10_000_000),
                                $naira('daily_reward_base', 'Daily login reward (base)', 1_000_000),
                                $naira('daily_reward_step', 'Daily login reward added per streak day', 1_000_000),
                                $naira('max_sales_per_shift', 'Flag shifts with sales above', 1_000_000_000),
                            ]),
                        ]),
                        Tab::make('Menu prices')->icon(Heroicon::OutlinedShoppingBag)->schema([
                            Grid::make(3)->schema($foods),
                        ]),
                        Tab::make('Restaurants')->icon(Heroicon::OutlinedBuildingStorefront)->schema($places),
                        Tab::make('Costs & taxes')->icon(Heroicon::OutlinedReceiptPercent)->schema([
                            Section::make('Price multipliers')->columns(3)->schema([
                                $factor('equipment_multiplier', 'Buka equipment'),
                                $factor('staff_multiplier', 'Staff hire cost and salaries'),
                                $factor('booster_multiplier', 'Boosters'),
                            ]),
                            Section::make('Taxes and bills')->columns(3)->schema([
                                TextInput::make('vat_rate')->label('VAT rate')->suffix('%')->required()->numeric()->minValue(0)->maxValue(50)
                                    ->dehydrateStateUsing(fn (mixed $state): float => (float) $state),
                                $factor('levy_multiplier', 'LGA levy'),
                                $factor('rent_multiplier', 'Rent & NEPA light'),
                            ]),
                        ]),
                        Tab::make('Market')->icon(Heroicon::OutlinedShoppingCart)->schema([
                            Section::make('Prices')->columns(2)->schema([
                                TextInput::make('inflation')->label('Average price rise per shift')->suffix('%')
                                    ->required()->numeric()->minValue(0)->maxValue(10)->step(0.1)
                                    ->dehydrateStateUsing(fn (mixed $state): float => (float) $state),
                                Textarea::make('market_news')->label('Market news headline')
                                    ->helperText('Replaces the game’s own market news. Leave empty for automatic news.')->maxLength(140)->rows(2),
                            ]),
                            CheckboxList::make('out_of_stock')->label('Sold out at the market right now')
                                ->options(MamaputConfig::INGREDIENTS)->columns(4),
                        ]),
                        Tab::make('Features')->icon(Heroicon::OutlinedPuzzlePiece)->schema([
                            Section::make('Gameplay systems')->columns(2)->schema([
                                Toggle::make('haggle')->label('Customers haggle over prices'),
                                Toggle::make('inspections')->label('Health inspector visits'),
                                Toggle::make('online_orders')->label('Online delivery orders'),
                                Toggle::make('events')->label('Catering event orders'),
                                TextInput::make('inspection_chance')->label('Inspection chance per shift')->suffix('%')
                                    ->required()->integer()->minValue(0)->maxValue(100)
                                    ->dehydrateStateUsing(fn (mixed $state): int => (int) $state),
                            ]),
                        ]),
                    ]),
            ]);
    }

    public function save(): void
    {
        MamaputConfig::store($this->form->getState());
        Notification::make()->title('Mama Put settings saved')->body('Players get them the next time the game starts.')->success()->send();
    }
}
