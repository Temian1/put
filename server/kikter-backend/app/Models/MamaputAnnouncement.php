<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A message admins send to players' inboxes, optionally with coins to claim.
 */
class MamaputAnnouncement extends Model
{
    public const AUDIENCES = ['all' => 'Every player', 'lagoslife' => 'Lagos Life players', 'player' => 'One player'];

    protected $fillable = ['title', 'body', 'audience', 'player_id', 'reward_coins', 'emailed', 'sent_count', 'created_by'];

    protected function casts(): array
    {
        return ['emailed' => 'boolean'];
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(MamaputPlayer::class, 'player_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(MamaputNotification::class, 'announcement_id');
    }
}
