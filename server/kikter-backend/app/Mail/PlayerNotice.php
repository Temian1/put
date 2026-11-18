<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;

/**
 * A message an admin writes to a player from the Filament panel.
 */
class PlayerNotice extends Mailable
{
    public const GAME_URL = 'https://mamaput-phi.vercel.app/';

    public function __construct(
        public string $playerName,
        public string $title,
        public string $body,
        public string $team,
        public ?string $actionUrl = null,
        public string $actionLabel = 'Play Mama Put Rush',
        public ?string $preferencesUrl = null,
        public ?string $unsubscribeUrl = null,
    ) {
        if ($this->team === 'Mama Put Rush') {
            $this->actionUrl = self::GAME_URL;
            $this->actionLabel = 'Play Mama Put Rush';
        }
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->title);
    }

    public function content(): Content
    {
        return new Content(html: 'mail.player-notice', text: 'mail.player-notice-text');
    }

    public function headers(): Headers
    {
        return new Headers(text: $this->unsubscribeUrl ? [
            'List-Unsubscribe' => '<'.$this->unsubscribeUrl.'>',
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ] : []);
    }
}
