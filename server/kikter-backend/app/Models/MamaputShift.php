<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One played shift (level, daily challenge or endless run) reported by the game. */
class MamaputShift extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['won' => 'boolean', 'flagged' => 'boolean'];
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(MamaputPlayer::class, 'player_id');
    }
}
