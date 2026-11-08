<?php

namespace App\Models;

use App\MamaputConfig;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * A Mama Put Rush player: a guest on one device, or signed in with a Kikter
 * account and/or Lagos Life so every device shares one save and wallet.
 * Holds the cloud save and the numbers the leaderboard ranks.
 */
class MamaputPlayer extends Model
{
    protected $fillable = ['name', 'user_id', 'vatar_player_id', 'coins', 'reputation', 'unlocked', 'banned_at'];

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

    public function vatarPlayer(): BelongsTo
    {
        return $this->belongsTo(VatarPlayer::class);
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(MamaputTicket::class, 'player_id');
    }

    public function walletLogs(): HasMany
    {
        return $this->hasMany(MamaputWalletLog::class, 'player_id');
    }

    /** Where the player signs in: guest, kikter, lagoslife or both. */
    public function source(): string
    {
        return match (true) {
            $this->user_id && $this->vatar_player_id => 'both',
            (bool) $this->user_id => 'kikter',
            (bool) $this->vatar_player_id => 'lagoslife',
            default => 'guest',
        };
    }

    public function shifts(): HasMany
    {
        return $this->hasMany(MamaputShift::class, 'player_id');
    }

    public function isBanned(): bool
    {
        return $this->banned_at !== null
            || ($this->user?->isBanned() ?? false)
            || ($this->vatarPlayer?->user?->isBanned() ?? false);
    }

    /**
     * Lagos Life itself supplies no email; linked platform accounts may have
     * one. Otherwise the unverified contact email the player typed in the game.
     */
    public function email(): ?string
    {
        return $this->accountEmail() ?? $this->contact_email;
    }

    public function accountEmail(): ?string
    {
        return $this->user?->email ?? $this->vatarPlayer?->user?->email;
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

    /** A new sign-in token for another device; returns the plain text once. */
    public function newToken(): string
    {
        $token = Str::random(48);
        DB::table('mamaput_tokens')->insert([
            'player_id' => $this->id, 'token_hash' => hash('sha256', $token),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return $token;
    }

    /** Signs the player out of every device. Guests have no way back in. */
    public function revokeAllTokens(): void
    {
        DB::table('mamaput_tokens')->where('player_id', $this->id)->delete();
        $this->token_hash = hash('sha256', Str::random(48));
        $this->save();
    }

    public static function revokeToken(string $token): void
    {
        $hash = hash('sha256', $token);
        DB::table('mamaput_tokens')->where('token_hash', $hash)->delete();
        // The first guest token lives on the player row; rotate it away.
        static::query()->where('token_hash', $hash)->update(['token_hash' => hash('sha256', Str::random(48))]);
    }

    public static function findByToken(?string $token): ?self
    {
        if (! $token) {
            return null;
        }
        $hash = hash('sha256', $token);
        $id = DB::table('mamaput_tokens')->where('token_hash', $hash)->value('player_id');

        return $id ? static::find($id) : static::query()->where('token_hash', $hash)->first();
    }

    /**
     * Copies the leaderboard numbers out of a save the game uploaded.
     *
     * @param  array<string, mixed>  $save
     */
    public function syncFromSave(array $save): void
    {
        // Support credits are issued on the server. Older clients must not
        // erase them, invent new credits, or restore a collected credit.
        $stored = $this->save ?? [];
        if ((int) ($save['saveEpoch'] ?? 0) === (int) ($stored['saveEpoch'] ?? 0)) {
            foreach (['stars', 'best'] as $field) {
                $merged = (array) ($stored[$field] ?? []);
                foreach ((array) ($save[$field] ?? []) as $key => $value) {
                    $merged[$key] = max($merged[$key] ?? 0, $value);
                }
                $save[$field] = $merged;
            }
            $save['unlocked'] = max($stored['unlocked'] ?? 1, $save['unlocked'] ?? 1);
        }
        if (isset($stored['saveRepair'])) $save['saveRepair'] = $stored['saveRepair'];
        $credits = (array) ($stored['growCredits'] ?? []);
        $save['growCredits'] = $credits;
        $save['growCollected'] = array_values(array_intersect(
            array_unique(array_merge(
                (array) ($stored['growCollected'] ?? []),
                (array) ($save['growCollected'] ?? []),
            )),
            array_keys($credits),
        ));
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
        // Side games: best Okada Rush endless run and Market Match progress.
        $side = (array) ($save['side'] ?? []);
        $this->okada_best = max(0, min(100000, (int) ($side['run']['best'] ?? 0)));
        $this->match_level = max(0, min(100000, (int) ($side['match']['level'] ?? 1) - 1));
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
        $save['saveEpoch'] = (int) ($this->save['saveEpoch'] ?? 0) + 1;
        $this->syncFromSave($save);
        $this->save_version++;
    }
}
