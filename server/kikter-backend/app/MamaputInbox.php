<?php

namespace App;

use App\Filament\Actions\EmailPlayers;
use App\Models\MamaputAnnouncement;
use App\Models\MamaputNotification;
use App\Models\MamaputPlayer;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Fills players' inboxes: announcements, "someone passed you" alerts and the
 * short messages rivals send each other.
 */
class MamaputInbox
{
    /** Leaderboards that send "passed" alerts: board => [column, label]. */
    public const BOARDS = [
        'sales' => ['lifetime_sales', 'Top Bukas'],
        'stars' => ['stars', 'Stars'],
        'endless' => ['endless_best', 'Endless Rush'],
        'okada' => ['okada_best', 'Okada Rush'],
        'match' => ['match_level', 'Market Match'],
    ];

    /** Only players ranked this high are told they were passed. */
    public const TOP = 50;

    /** One save can pass many players; each alert is written separately. */
    private const MAX_ALERTS = 10;

    public const MESSAGE_LENGTH = 80;

    private const BLOCKED_WORDS = ['fuck', 'fucking', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'pussy', 'cunt', 'nigger', 'ashawo', 'werey', 'oloshi', 'olodo', 'mumu'];

    /** Real players: signed in and not banned. */
    public static function eligible(): Builder
    {
        return MamaputPlayer::query()->whereNull('banned_at')
            ->where(fn (Builder $q) => $q->whereNotNull('user_id')->orWhereNotNull('vatar_player_id'));
    }

    /** @return array<string, int> the board columns before a save */
    public static function snapshot(MamaputPlayer $p): array
    {
        return collect(self::BOARDS)->mapWithKeys(fn (array $b): array => [$b[0] => (int) $p->{$b[0]}])->all();
    }

    /**
     * After a save, tells each top-50 player this one moved past, at most
     * once per board per day.
     *
     * @param  array<string, int>  $before
     */
    public static function passed(MamaputPlayer $p, array $before): void
    {
        if ($p->isBanned() || $p->source() === 'guest') {
            return;
        }
        $alerts = 0;
        foreach (self::BOARDS as $board => [$column, $label]) {
            $old = $before[$column] ?? 0;
            $new = (int) $p->{$column};
            if ($new <= $old) {
                continue;
            }
            $rivals = self::eligible()->whereKeyNot($p->id)
                ->where($column, '>', 0)->where($column, '>=', $old)->where($column, '<', $new)
                ->orderByDesc($column)->limit(self::MAX_ALERTS)->get();
            foreach ($rivals as $rival) {
                $rank = self::eligible()->where($column, '>', $rival->{$column})->count() + 1;
                $ref = 'passed:'.$board.':'.now()->toDateString();
                if ($rank > self::TOP + 1 || $alerts >= self::MAX_ALERTS
                    || $rival->notifications()->where('ref', $ref)->exists()) {
                    continue;
                }
                $rival->notifications()->create([
                    'type' => 'passed', 'from_player_id' => $p->id, 'ref' => $ref,
                    'title' => "{$p->name} passed you on {$label}",
                    'body' => "You're now #{$rank}. Take your place back!",
                ]);
                $alerts++;
            }
        }
    }

    /** Shortens a rival message, removes links and hides rude words. */
    public static function clean(string $text): string
    {
        $text = preg_replace('~(https?://|www\.)\S+~iu', '', $text);
        $text = preg_replace('~\S+\.(com|ng|net|org|io|me|co)\b\S*~iu', '', $text);
        $text = trim(preg_replace('/\s+/u', ' ', (string) $text));
        foreach (self::BLOCKED_WORDS as $word) {
            $text = preg_replace('/\b'.preg_quote($word, '/').'\b/iu', str_repeat('*', mb_strlen($word)), $text);
        }

        return mb_substr($text, 0, self::MESSAGE_LENGTH);
    }

    /** Answers a passed alert or a message, once. */
    public static function reply(MamaputNotification $note, string $text): void
    {
        abort_unless($note->canReply(), 422, 'You have already answered this.');
        $text = self::clean($text);
        abort_if($text === '', 422, 'Write a short message.');
        $note->replied_at = now();
        $note->save();
        $from = $note->player;
        $to = $note->fromPlayer;
        if (! $to || $to->isBanned() || $to->mutes()->where('muted_player_id', $from->id)->exists()) {
            return;
        }
        $to->notifications()->create([
            'type' => 'message', 'from_player_id' => $from->id,
            'title' => "{$from->name} sent you a message", 'body' => $text,
        ]);
    }

    public static function mute(MamaputPlayer $player, int $rivalId): void
    {
        if ($rivalId !== $player->id) {
            $player->mutes()->firstOrCreate(['muted_player_id' => $rivalId]);
        }
    }

    /**
     * Sends an announcement into every chosen inbox, and by email when asked.
     *
     * @param  array<string, mixed>  $data
     */
    public static function announce(array $data, ?User $admin): MamaputAnnouncement
    {
        $announcement = MamaputAnnouncement::create([
            'title' => $data['title'], 'body' => $data['body'], 'audience' => $data['audience'],
            'player_id' => $data['audience'] === 'player' ? $data['player_id'] : null,
            'reward_coins' => (int) ($data['reward_coins'] ?? 0), 'emailed' => (bool) ($data['email'] ?? false),
            'created_by' => $admin?->id,
        ]);
        $players = match ($announcement->audience) {
            'player' => self::eligible()->whereKey($announcement->player_id),
            'lagoslife' => self::eligible()->whereNotNull('vatar_player_id'),
            default => self::eligible(),
        };
        $sent = 0;
        // Only ids are needed here; the email step below needs whole rows.
        (clone $players)->select('id')->chunkById(500, function ($chunk) use ($announcement, &$sent): void {
            $now = now();
            DB::table('mamaput_notifications')->insert($chunk->map(fn (MamaputPlayer $p): array => [
                'player_id' => $p->id, 'type' => 'announcement', 'announcement_id' => $announcement->id,
                'title' => $announcement->title, 'body' => $announcement->body,
                'reward_coins' => $announcement->reward_coins, 'created_at' => $now, 'updated_at' => $now,
            ])->all());
            $sent += $chunk->count();
        });
        $announcement->update(['sent_count' => $sent]);
        if ($announcement->emailed) {
            EmailPlayers::send(
                $players->with(['user', 'vatarPlayer.user'])->get()
                    ->map(fn (MamaputPlayer $p): array => ['email' => $p->email(), 'name' => $p->name]),
                $announcement->title, $announcement->body, 'Mama Put Rush',
            );
        }

        return $announcement;
    }

    /** Pays an announcement's coins once. Returns the coins paid. */
    public static function claim(MamaputNotification $note): int
    {
        return DB::transaction(function () use ($note): int {
            $row = MamaputNotification::whereKey($note->id)->lockForUpdate()->firstOrFail();
            abort_if($row->reward_coins < 1, 422, 'There is nothing to claim.');
            abort_if($row->claimed_at !== null, 422, 'Already claimed.');
            $row->claimed_at = now();
            $row->save();
            MamaputAccounts::credit($row->player, $row->reward_coins, 'inbox', 'note:'.$row->id);

            return $row->reward_coins;
        });
    }

    /** @return array<string, mixed> */
    public static function forClient(MamaputPlayer $p): array
    {
        $notes = $p->notifications()->with('fromPlayer:id,name')->latest('id')->limit(40)->get();

        return [
            'notes' => $notes->map(fn (MamaputNotification $n): array => [
                'id' => $n->id, 'type' => $n->type, 'title' => $n->title, 'body' => $n->body,
                'at' => $n->created_at?->toIso8601String(), 'read' => $n->read_at !== null,
                'reward' => $n->reward_coins, 'claimed' => $n->claimed_at !== null,
                'canReply' => $n->canReply() && $n->fromPlayer !== null,
                'from' => $n->fromPlayer ? ['id' => $n->fromPlayer->id, 'name' => $n->fromPlayer->name] : null,
                'board' => str_starts_with((string) $n->ref, 'passed:') ? explode(':', $n->ref)[1] : null,
            ])->all(),
            'unread' => $p->notifications()->whereNull('read_at')->count(),
        ];
    }
}
