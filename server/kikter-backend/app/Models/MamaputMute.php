<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A player who chose not to receive messages from another player.
 */
class MamaputMute extends Model
{
    protected $fillable = ['player_id', 'muted_player_id'];
}
