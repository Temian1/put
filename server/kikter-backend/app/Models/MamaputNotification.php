<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One item in a player's inbox: an announcement, a "you were passed" alert,
 * a short message from a rival or a support reply.
 */
class MamaputNotification extends Model
{
    protected $fillable = ['player_id', 'type', 'title', 'body', 'from_player_id', 'announcement_id', 'reward_coins', 'ref'];

    protected function casts(): array
    {
        return [
            'replied_at' => 'datetime',
            'read_at' => 'datetime',
            'claimed_at' => 'datetime',
        ];
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(MamaputPlayer::class, 'player_id');
    }

    public function fromPlayer(): BelongsTo
    {
        return $this->belongsTo(MamaputPlayer::class, 'from_player_id');
    }

    public function announcement(): BelongsTo
    {
        return $this->belongsTo(MamaputAnnouncement::class, 'announcement_id');
    }

    /** Passed alerts and messages can be answered once, if the sender still exists. */
    public function canReply(): bool
    {
        return in_array($this->type, ['passed', 'message'], true)
            && $this->from_player_id !== null && $this->replied_at === null;
    }
}
