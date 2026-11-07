<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One message in a support conversation, from the player or from support.
 */
class MamaputTicketMessage extends Model
{
    protected $fillable = ['user_id', 'from_support', 'body'];

    protected function casts(): array
    {
        return ['from_support' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
