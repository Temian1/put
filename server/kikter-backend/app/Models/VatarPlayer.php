<?php

namespace App\Models;

use App\GameStore;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VatarPlayer extends Model
{
    use HasFactory;

    protected $fillable = ['mode', 'game_id', 'player_id', 'name', 'progress', 'user_id'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return ['progress' => 'array'];
    }

    public function profile(): array
    {
        return array_merge([
            'xp' => 0, 'rating' => 1000, 'wins' => 0, 'losses' => 0, 'matches' => 0,
            'blocks' => 0, 'shots' => 0, 'hits' => 0, 'repairs' => 0, 'eliminations' => 0,
            'streak' => 0, 'best_streak' => 0, 'missions' => null, 'daily_streak' => 0, 'daily_claimed_on' => null,
        ], $this->progress ?? [], [
            'user_id' => -$this->id, 'name' => $this->name,
            'owned_skins' => VatarPurchase::where('vatar_player_id', $this->id)->whereIn('status', ['paid', 'delivered'])->whereNotNull('granted_at')->whereNotNull('skin')->pluck('skin')->unique()->values()->all(),
            'inventory' => GameStore::clean($this->progress['inventory'] ?? []),
        ]);
    }
}
