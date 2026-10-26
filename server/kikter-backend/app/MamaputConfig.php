<?php

namespace App;

use App\Models\GameSetting;
use App\Models\VatarSetting;
use Illuminate\Support\Facades\Cache;

/**
 * Live configuration for Mama Put Rush, stored as one `game_settings` row
 * (key "mamaput") so admins can change the game without a deploy.
 */
final class MamaputConfig
{
    public const KEY = 'mamaput';

    private const CACHE_KEY = 'mamaput-config';

    /** Menu items with their default naira price (matches the game client). */
    public const FOODS = [
        'jollof' => ['Jollof Rice', 900], 'friedrice' => ['Fried Rice', 1000],
        'whiterice' => ['Rice & Stew', 800], 'beans' => ['Ewa Agoyin', 700],
        'eba' => ['Eba', 400], 'amala' => ['Amala', 500], 'poundedyam' => ['Pounded Yam', 800],
        'peppersoup' => ['Goat Pepper Soup', 2500], 'egusi' => ['Egusi Soup', 700],
        'efo' => ['Efo Riro', 800], 'ewedu' => ['Ewedu & Gbegiri', 500], 'beef' => ['Beef', 600],
        'chicken' => ['Fried Chicken', 2500], 'fish' => ['Fried Fish', 1200], 'egg' => ['Boiled Egg', 300],
        'plantain' => ['Dodo', 500], 'moimoi' => ['Moi Moi', 700], 'water' => ['Pure Water', 100],
        'zobo' => ['Zobo', 500], 'mineral' => ['Mineral', 700], 'malt' => ['Malt', 800],
    ];

    /** Restaurants (one per chapter): name, opening cost, income per shift. */
    public const PLACES = [
        ['Roadside Buka', 0, 1000], ['Junction Food Spot', 50000, 1500], ['Swallow Joint', 120000, 3000],
        ['Owambe Catering', 250000, 5000], ['Mama Put Empire', 450000, 7500],
        ['Ikeja City Restaurant', 700000, 10000], ['Port Harcourt Branch', 1000000, 13000],
        ['Abuja Food Court', 1400000, 17000], ['Catering Company', 1900000, 22000],
        ['Food Empire HQ', 2500000, 28000],
    ];

    /** Market ingredient groups the admin can mark as sold out. */
    public const INGREDIENTS = [
        'rice' => 'Rice & stew', 'beans' => 'Beans', 'swallow' => 'Garri, elubo & yam',
        'veg' => 'Pepper, tomato & leaves', 'meat' => 'Meat, fish & eggs', 'chicken' => 'Chicken',
        'plantain' => 'Plantain', 'drinks' => 'Drinks',
    ];

    /**
     * What a Lagos Life product can give in Mama Put: the game's own shop
     * items (ids match the client), naira for the buka, or wallet coins.
     */
    public const ITEMS = [
        'booster' => ['freeze' => 'Freeze Time booster', 'auto' => 'Auto-Serve booster', 'calm' => 'Patience Boost booster'],
        'upgrade' => ['fast' => 'Sharp Sharp Hands', 'patience' => 'Sweet Mouth', 'tips' => 'Big Tips', 'time' => 'Generator'],
        'outfit' => ['teal' => 'Lagos Teal outfit', 'royal' => 'Royal Purple outfit', 'gold' => 'Owambe Gold outfit'],
        'decor' => ['plants' => 'Potted Plants', 'bunting' => 'Party Bunting', 'lights' => 'Fairy Lights'],
        'equipment' => [
            'tables' => 'Plastic table & chairs', 'fridge' => 'Deep freezer', 'burner' => 'Extra gas burner',
            'bigpots' => 'Bigger pots', 'sink' => 'Double sink', 'handwash' => 'Handwash station & bin',
            'uniforms' => 'Staff uniforms & caps', 'store' => 'Store room shelves', 'sign' => 'Lit signboard',
            'building' => 'Renovate the building', 'bike' => 'Delivery okada', 'bus' => 'Catering bus',
        ],
        'cash' => [],
        'coins' => [],
    ];

    public const ITEM_TYPES = [
        'booster' => 'Booster (amount = how many)', 'upgrade' => 'Upgrade level (amount = levels)',
        'outfit' => 'Outfit', 'decor' => 'Decoration', 'equipment' => 'Equipment level at the current restaurant',
        'cash' => 'Naira for the buka (amount = ₦)', 'coins' => 'Wallet coins (amount = coins)',
    ];

    /** Lagos Life products to create in the Mama Put game, ready to use. */
    public const SUGGESTED_PRODUCTS = [
        ['product_id' => 'mp_freeze_3', 'name' => '3 Freeze Time boosters', 'type' => 'booster', 'item' => 'freeze', 'amount' => 3],
        ['product_id' => 'mp_auto_3', 'name' => '3 Auto-Serve boosters', 'type' => 'booster', 'item' => 'auto', 'amount' => 3],
        ['product_id' => 'mp_calm_3', 'name' => '3 Patience boosters', 'type' => 'booster', 'item' => 'calm', 'amount' => 3],
        ['product_id' => 'mp_outfit_royal', 'name' => 'Royal Purple outfit', 'type' => 'outfit', 'item' => 'royal', 'amount' => 1],
        ['product_id' => 'mp_outfit_gold', 'name' => 'Owambe Gold outfit', 'type' => 'outfit', 'item' => 'gold', 'amount' => 1],
        ['product_id' => 'mp_decor_lights', 'name' => 'Fairy Lights', 'type' => 'decor', 'item' => 'lights', 'amount' => 1],
        ['product_id' => 'mp_fridge', 'name' => 'Deep freezer', 'type' => 'equipment', 'item' => 'fridge', 'amount' => 1],
        ['product_id' => 'mp_renovate', 'name' => 'Renovate the building', 'type' => 'equipment', 'item' => 'building', 'amount' => 1],
        ['product_id' => 'mp_generator', 'name' => 'Generator upgrade', 'type' => 'upgrade', 'item' => 'time', 'amount' => 1],
        ['product_id' => 'mp_cash_50k', 'name' => '₦50,000 for your buka', 'type' => 'cash', 'item' => '', 'amount' => 50000],
        ['product_id' => 'mp_coins_100', 'name' => '100 coins', 'type' => 'coins', 'item' => '', 'amount' => 100],
    ];

    /** Business levels: lifetime sales and reputation needed (matches the client). */
    public const TIERS = [
        ['Roadside Buka', 0, 0], ['Busy Buka', 250000, 48], ['Popular Joint', 1200000, 56],
        ['Catering Business', 4000000, 64], ['Food Empire', 12000000, 72],
    ];

    public const DEFAULTS = [
        'maintenance' => false,
        'announcement' => null,
        'start_cash' => 3000,
        'daily_reward_base' => 1000,
        'daily_reward_step' => 500,
        'daily_bonus' => 6000,
        'food_prices' => [],
        'opening_costs' => [],
        'branch_income' => [],
        'equipment_multiplier' => 1.0,
        'staff_multiplier' => 1.0,
        'booster_multiplier' => 1.0,
        'vat_rate' => 7.5,
        'levy_multiplier' => 1.0,
        'rent_multiplier' => 1.0,
        'inflation' => 0.7,
        'market_news' => null,
        'out_of_stock' => [],
        'haggle' => true,
        'inspections' => true,
        'online_orders' => true,
        'events' => true,
        'inspection_chance' => 40,
        'max_sales_per_shift' => 3000000,
        'leaderboard_enabled' => true,
        'guests_allowed' => true,
        'lagoslife_enabled' => true,
        'coins_per_win' => 5,
        'coins_daily_cap' => 100,
        'coin_naira_rate' => 200,
        'coins_exchange_min' => 10,
        'lagoslife_products' => self::SUGGESTED_PRODUCTS,
    ];

    /** @return array<string, mixed> */
    public static function values(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, function (): array {
            $stored = GameSetting::query()->where('key', self::KEY)->value('value');

            return array_merge(self::DEFAULTS, is_array($stored) ? $stored : []);
        });
    }

    public static function get(string $key): mixed
    {
        return self::values()[$key] ?? self::DEFAULTS[$key] ?? null;
    }

    /** @param  array<string, mixed>  $values */
    public static function store(array $values): void
    {
        $merged = array_merge(self::values(), array_intersect_key($values, self::DEFAULTS));
        GameSetting::query()->updateOrCreate(['key' => self::KEY], ['value' => $merged]);
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * A Lagos Life product with what it gives. Older coin packs stored only
     * `coins`, so they read as type "coins".
     *
     * @return array{product_id: string, name: string, type: string, item: string, amount: int}|null
     */
    public static function product(string $id): ?array
    {
        $p = collect((array) self::get('lagoslife_products'))->first(fn (array $p): bool => ($p['product_id'] ?? '') === $id);

        return $p ? self::normalize($p) : null;
    }

    /** @return array{product_id: string, name: string, type: string, item: string, amount: int} */
    public static function normalize(array $p): array
    {
        $type = isset(self::ITEMS[$p['type'] ?? '']) ? $p['type'] : 'coins';
        $item = (string) ($p['item'] ?? '');

        return [
            'product_id' => (string) $p['product_id'], 'name' => (string) ($p['name'] ?? $p['product_id']),
            'type' => $type, 'item' => isset(self::ITEMS[$type][$item]) ? $item : '',
            'amount' => max(1, (int) ($p['amount'] ?? $p['coins'] ?? 1)),
        ];
    }

    public static function tierOf(int $sales, float $reputation): int
    {
        $tier = 0;
        foreach (self::TIERS as $i => [, $earn, $rep]) {
            if ($sales >= $earn && $reputation >= $rep) {
                $tier = $i;
            }
        }

        return $tier;
    }

    /**
     * Everything the game client reads. Nothing secret belongs here.
     *
     * @return array<string, mixed>
     */
    public static function forClient(): array
    {
        $v = self::values();
        $prices = [];
        foreach (self::FOODS as $id => [, $default]) {
            $prices[$id] = (int) ($v['food_prices'][$id] ?? $default);
        }
        $places = [];
        foreach (self::PLACES as $i => [, $cost, $income]) {
            $places[] = [
                'cost' => (int) ($v['opening_costs'][$i] ?? $cost),
                'income' => (int) ($v['branch_income'][$i] ?? $income),
            ];
        }

        return [
            'maintenance' => (bool) $v['maintenance'],
            'announcement' => $v['announcement'] ?: null,
            'startCash' => (int) $v['start_cash'],
            'dailyReward' => ['base' => (int) $v['daily_reward_base'], 'step' => (int) $v['daily_reward_step']],
            'dailyBonus' => (int) $v['daily_bonus'],
            'foodPrices' => $prices,
            'places' => $places,
            'multipliers' => [
                'equipment' => (float) $v['equipment_multiplier'],
                'staff' => (float) $v['staff_multiplier'],
                'boosters' => (float) $v['booster_multiplier'],
                'levy' => (float) $v['levy_multiplier'],
                'rent' => (float) $v['rent_multiplier'],
            ],
            'vatRate' => (float) $v['vat_rate'] / 100,
            'market' => [
                'inflation' => (float) $v['inflation'] / 100,
                'news' => $v['market_news'] ?: null,
                'outOfStock' => array_values((array) $v['out_of_stock']),
            ],
            'features' => [
                'haggle' => (bool) $v['haggle'],
                'inspections' => (bool) $v['inspections'],
                'onlineOrders' => (bool) $v['online_orders'],
                'events' => (bool) $v['events'],
                'leaderboard' => (bool) $v['leaderboard_enabled'],
            ],
            'inspectionChance' => (float) $v['inspection_chance'] / 100,
            'accounts' => [
                'guests' => (bool) $v['guests_allowed'],
                'lagoslife' => (bool) $v['lagoslife_enabled'] && VatarSetting::mamaput()->configured(),
            ],
            'wallet' => [
                'perWin' => (int) $v['coins_per_win'],
                'dailyCap' => (int) $v['coins_daily_cap'],
                'rate' => (int) $v['coin_naira_rate'],
                'min' => (int) $v['coins_exchange_min'],
            ],
            'lagoslifeProducts' => array_values(array_map(function (array $p): array {
                $p = self::normalize($p);

                return ['productId' => $p['product_id'], 'name' => $p['name'], 'type' => $p['type'],
                    'item' => $p['item'], 'amount' => $p['amount'],
                    // Kept for game versions that only knew coin packs.
                    'coins' => $p['type'] === 'coins' ? $p['amount'] : 0];
            }, (array) $v['lagoslife_products'])),
        ];
    }
}
