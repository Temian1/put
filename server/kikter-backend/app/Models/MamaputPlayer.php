<?php

namespace App\Models;

use App\MamaputConfig;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A Mama Put Rush player (one per device, optionally linked to a Kikter
 * account). Holds the cloud save and the numbers the leaderboard ranks.
 */
class MamaputPlayer extends Model
{
    protected $fillable = ['name', 'user_id', 'coins', 'reputation', 'unlocked', 'banned_at'];

    protected $hidden = ['token_hash', 'save'];

    protected function casts(): array
    {
        return [
            'save' => 'array',
            'reputation' => 'float',
            'banned_at' => 'datetime',
            'last_seen_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function shifts(): HasMany
    {
        return $this->hasMany(MamaputShift::class, 'player_id');
    }

    public function isBanned(): bool
    {
        return $this->banned_at !== null;
    }

    /**
     * Creates a player and returns it with its plain-text API token, which is
     * shown only once; the database keeps a SHA-256 hash.
     *
     * @return array{0: self, 1: string}
     */
    public static function issue(?string $name): array
    {
        $token = Str::random(48);
        $player = new self(['name' => $name ?: 'Mama Put '.random_int(1000, 9999)]);
        $player->token_hash = hash('sha256', $token);
        $player->last_seen_at = now();
        $player->save();

        return [$player, $token];
    }

    public static function findByToken(?string $token): ?self
    {
        return $token ? static::query()->where('token_hash', hash('sha256', $token))->first() : null;
    }

    /**
     * Copies the leaderboard numbers out of a save the game uploaded.
     *
     * @param  array<string, mixed>  $save
     */
    public function syncFromSave(array $save): void
    {
        $this->save = $save;
        $this->coins = max(0, (int) ($save['coins'] ?? 0));
        $this->reputation = max(0, min(100, (float) ($save['reputation'] ?? 50)));
        $this->unlocked = max(1, (int) ($save['unlocked'] ?? 1));
        $this->stars = (int) array_sum(array_map('intval', (array) ($save['stars'] ?? [])));
        $this->lifetime_sales = max(0, (int) ($save['stats']['earn'] ?? 0));
        $this->endless_best = max(0, (int) ($save['endlessBest'] ?? 0));
        $this->tier = MamaputConfig::tierOf($this->lifetime_sales, $this->reputation);
        $this->restaurants = count((array) ($save['branches'] ?? ['ch0']));
        $this->staff_count = count((array) ($save['staff'] ?? []));
    }

    /**
     * Applies an admin edit to the stored save too, stamped as newest so the
     * game takes the admin's money and progress on its next sync.
     *
     * @param  array<string, mixed>  $changes
     */
    public function applyAdminChanges(array $changes): void
    {
        $save = $this->save ?? [];
        foreach (['coins' => 'coins', 'reputation' => 'reputation', 'unlocked' => 'unlocked'] as $column => $key) {
            if (array_key_exists($column, $changes)) {
                $save[$key] = $changes[$column];
            }
        }
        $save['updatedAt'] = (int) (microtime(true) * 1000) + 60000;
        $save['adminEdit'] = true;
        $this->syncFromSave($save);
        $this->save_version++;
    }
}
