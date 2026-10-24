<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One change to a Mama Put player's coin wallet: shift rewards, coins swapped
 * for in-game naira, Lagos Life purchases and admin adjustments.
 */
class MamaputWalletLog extends Model
{
    protected $fillable = ['player_id', 'user_id', 'amount', 'balance', 'reason', 'ref'];

    public function player(): BelongsTo
    {
        return $this->belongsTo(MamaputPlayer::class, 'player_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
