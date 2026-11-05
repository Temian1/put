<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * A message an admin writes to a player from the Filament panel.
 */
class PlayerNotice extends Mailable
{
    public function __construct(
        public string $playerName,
        public string $title,
        public string $body,
        public string $team,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->title);
    }

    public function content(): Content
    {
        return new Content(html: 'mail.player-notice', text: 'mail.player-notice-text');
    }
}
