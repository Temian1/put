<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VatarSetting extends Model
{
    use HasFactory;

    protected $fillable = ['id', 'enabled', 'mode', 'secret', 'webhook_secret', 'results_secret', 'products'];

    protected $hidden = ['secret', 'webhook_secret', 'results_secret'];

    protected function casts(): array
    {
        return ['enabled' => 'boolean', 'secret' => 'encrypted', 'webhook_secret' => 'encrypted', 'results_secret' => 'encrypted', 'products' => 'array'];
    }

    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1], ['enabled' => false, 'mode' => 'test', 'products' => []]);
    }

    /**
     * Keys for Mama Put Rush when it is its own Lagos Life game (row 2);
     * otherwise it shares the Lagos War keys.
     */
    public static function mamaput(): self
    {
        $own = static::find(2);

        return $own && $own->configured() ? $own : static::current();
    }

    public function configured(): bool
    {
        return $this->enabled && filled($this->secret);
    }

    public function product(string $id): ?array
    {
        return collect($this->products ?? [])->first(fn (array $product): bool => $product['product_id'] === $id);
    }
}
