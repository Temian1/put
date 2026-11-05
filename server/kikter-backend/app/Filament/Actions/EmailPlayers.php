<?php

namespace App\Filament\Actions;

use App\Mail\PlayerNotice;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Schemas\Components\Utilities\Set;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * The email form and sending shared by the Mama Put players table and the
 * accounts table.
 */
class EmailPlayers
{
    /** Mail is sent during the request, so one send stays small. */
    public const LIMIT = 200;

    public const TEMPLATES = [
        'update' => ['Game update', 'News from the game', "We have something new for you.\n\n"],
        'reward' => ['Reward', 'A reward is waiting for you', "Thanks for playing. Your reward is ready in the game.\n\n"],
        'maintenance' => ['Maintenance', 'Planned maintenance', "The game will be unavailable for a short time while we work on it.\n\n"],
        'warning' => ['Account warning', 'A warning about your account', "We need to talk to you about how your account has been used.\n\n"],
    ];

    /** @return array<int, mixed> */
    public static function fields(): array
    {
        return [
            Select::make('template')->label('Start from')->placeholder('Blank message')
                ->options(collect(self::TEMPLATES)->map(fn (array $t): string => $t[0]))
                ->live()->dehydrated(false)
                ->afterStateUpdated(function (?string $state, Set $set): void {
                    if ($template = self::TEMPLATES[$state] ?? null) {
                        $set('subject', $template[1]);
                        $set('message', $template[2]);
                    }
                }),
            TextInput::make('subject')->required()->maxLength(150),
            Textarea::make('message')->required()->rows(7)->maxLength(5000),
        ];
    }

    /**
     * Sends one message to each recipient and reports the result to the admin.
     *
     * @param  iterable<array{email: ?string, name: string}>  $recipients
     */
    public static function send(iterable $recipients, string $subject, string $message, string $team): void
    {
        $list = collect($recipients);
        $valid = $list->filter(fn (array $r): bool => (bool) filter_var($r['email'], FILTER_VALIDATE_EMAIL))
            ->unique(fn (array $r): string => strtolower($r['email']));
        $batch = $valid->take(self::LIMIT);
        $sent = 0;
        foreach ($batch as $r) {
            try {
                Mail::to($r['email'])->send(new PlayerNotice($r['name'], $subject, $message, $team));
                $sent++;
            } catch (Throwable $e) {
                report($e);
            }
        }
        Log::info('Admin email', ['admin' => Auth::user()?->email, 'subject' => $subject, 'sent' => $sent]);

        if (in_array(config('mail.default'), ['log', 'array'], true)) {
            Notification::make()->title('Not delivered')->warning()
                ->body('MAIL_MAILER is "'.config('mail.default').'", so nothing leaves the server.')->send();

            return;
        }
        $notes = array_filter([
            $list->count() > $valid->count() ? ($list->count() - $valid->count()).' skipped: no email address.' : null,
            $valid->count() > $batch->count() ? ($valid->count() - $batch->count()).' not sent: the limit for one send is '.self::LIMIT.'.' : null,
            $batch->count() > $sent ? ($batch->count() - $sent).' failed. See the application log.' : null,
        ]);
        Notification::make()->title("Email sent to {$sent} ".($sent === 1 ? 'player' : 'players'))
            ->status($sent ? 'success' : 'danger')->body(implode(' ', $notes) ?: null)->send();
    }
}
