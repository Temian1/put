<?php

namespace App\Models;

use App\MamaputAirtime;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A player's phone number for the airtime draw and what happened to it.
 */
class MamaputAirtimeEntry extends Model
{
    public const STATUSES = ['pending' => 'Waiting', 'picked' => 'Picked to win', 'sent' => 'Sent', 'rejected' => 'Rejected'];

    protected $fillable = ['phone', 'network', 'detected', 'level_at_entry', 'status'];

    protected function casts(): array
    {
        return ['handled_at' => 'datetime'];
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(MamaputPlayer::class, 'player_id');
    }

    public function isOpen(): bool
    {
        return in_array($this->status, ['pending', 'picked'], true);
    }

    /** Has reached the level the draw asks for. */
    public function eligible(): bool
    {
        return (int) $this->player?->unlocked >= MamaputAirtime::LEVEL;
    }

    public function mark(string $status, ?User $admin): void
    {
        $this->forceFill(['status' => $status, 'handled_by' => $admin?->id, 'handled_at' => now()])->save();
        if ($status === 'sent') {
            $this->player?->notifications()->create([
                'type' => 'airtime', 'title' => 'You won airtime! 📱',
                'body' => 'We have sent airtime to '.$this->maskedPhone().' on '.(MamaputAirtime::NETWORKS[$this->network] ?? $this->network).'. Thanks for playing!',
            ]);
        }
    }

    /** "0803****567": enough for the player to recognise it. */
    public function maskedPhone(): string
    {
        return substr($this->phone, 0, 4).'****'.substr($this->phone, -3);
    }
}
