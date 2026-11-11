<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A request or complaint a player sent from the game, with its conversation.
 */
class MamaputTicket extends Model
{
    public const CATEGORIES = [
        'request' => 'Request',
        'complaint' => 'Complaint',
        'problem' => 'Game problem',
        'payment' => 'Payment or coins',
        'account' => 'My account',
        'other' => 'Something else',
    ];

    public const STATUSES = ['open' => 'Waiting for us', 'answered' => 'Answered', 'closed' => 'Closed'];

    /** A player can wait on this many tickets at once. */
    public const MAX_OPEN = 5;

    protected $fillable = ['category', 'status', 'unread'];

    protected function casts(): array
    {
        return ['unread' => 'boolean'];
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(MamaputPlayer::class, 'player_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(MamaputTicketMessage::class, 'ticket_id')->orderBy('id');
    }

    public function isClosed(): bool
    {
        return $this->status === 'closed';
    }

    public function addPlayerMessage(string $body): void
    {
        $this->messages()->create(['body' => $body]);
        $this->update(['status' => 'open']);
    }

    public function addReply(?User $admin, string $body): void
    {
        $this->messages()->create(['body' => $body, 'from_support' => true, 'user_id' => $admin?->id]);
        $this->update(['status' => 'answered', 'unread' => true]);
        $this->player?->notifications()->create([
            'type' => 'support', 'title' => 'Support replied to you',
            'body' => (string) str($body)->squish()->limit(140),
        ]);
    }

    public function close(): void
    {
        $this->update(['status' => 'closed']);
    }

    public function reopen(): void
    {
        $this->update(['status' => 'open']);
    }

    /** First line of the first message, for tables. */
    public function preview(): string
    {
        return (string) str($this->messages->first()?->body)->squish()->limit(70);
    }
}
