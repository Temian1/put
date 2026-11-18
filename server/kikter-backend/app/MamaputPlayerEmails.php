<?php

namespace App;

use App\Mail\PlayerNotice;
use App\Models\MamaputPlayer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Throwable;

class MamaputPlayerEmails
{
    public static function recipient(MamaputPlayer $p): ?string
    {
        foreach ([$p->accountEmail(), $p->contact_email] as $email) {
            $email = trim((string) $email);
            if (filter_var($email, FILTER_VALIDATE_EMAIL)) return strtolower($email);
        }
        return null;
    }

    private static function allowed(MamaputPlayer $p): bool
    {
        return $p->source() !== 'guest' && ! $p->isBanned() && ! $p->email_opted_out_at && self::recipient($p) !== null;
    }

    private static function enqueue(MamaputPlayer $p, string $kind, string $key, array $payload): bool
    {
        if (! self::allowed($p)) return false;
        return (bool) DB::table('mamaput_player_emails')->insertOrIgnore([
            'player_id' => $p->id, 'kind' => $kind, 'dedupe_key' => hash('sha256', $key),
            'recipient' => self::recipient($p), 'payload' => json_encode($payload),
            'status' => 'pending', 'attempts' => 0, 'available_at' => now(),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public static function passed(MamaputPlayer $p, array $before): void
    {
        if ($p->source() === 'guest' || $p->isBanned()) return;
        foreach (MamaputInbox::BOARDS as $board => [$column, $label]) {
            $old = $before[$column] ?? 0;
            $new = (int) $p->{$column};
            if ($new <= $old) continue;
            MamaputInbox::eligible()->with(['user', 'vatarPlayer.user'])->whereKeyNot($p->id)
                ->where($column, '>', 0)->where($column, '>=', $old)->where($column, '<', $new)
                ->chunkById(100, function ($rivals) use ($p, $board, $column, $label): void {
                    foreach ($rivals as $rival) {
                        if (! self::allowed($rival)) continue;
                        $rank = MamaputInbox::eligible()->where($column, '>', $rival->{$column})->count() + 1;
                        self::enqueue($rival, 'passed', 'passed:'.self::recipient($rival).':'.$board.':'.now('Africa/Lagos')->toDateString(), [
                            'title' => "{$p->name} just passed your buka!",
                            'body' => "{$p->name} moved ahead of you on {$label}. You are now #{$rank}.\n\nReady for a comeback? Serve a fresh shift, keep your customers happy, and make your next climb up the leaderboard.",
                        ]);
                    }
                });
        }
    }

    public static function inactivity(bool $dryRun = false): int
    {
        // One shared address gets one reminder, only when none of its
        // eligible profiles have played within the last two days.
        $groups = MamaputInbox::eligible()->with(['user', 'vatarPlayer.user'])->get()
            ->filter(fn ($p) => self::allowed($p))->groupBy(fn ($p) => self::recipient($p));
        $count = 0;
        foreach ($groups as $email => $profiles) {
            $p = $profiles->sortByDesc(fn ($p) => $p->last_seen_at?->getTimestamp() ?? $p->created_at->getTimestamp())->first();
            $seen = $p->last_seen_at ?? $p->created_at;
            if ($seen->gt(now()->subDays(2))) continue;
            $key = 'inactive:'.$email.':'.$seen->getTimestamp();
            if ($dryRun) {
                $count += ! DB::table('mamaput_player_emails')->where('dedupe_key', hash('sha256', $key))->exists();
                continue;
            }
            $count += self::enqueue($p, 'inactive', $key, [
                'title' => "Your buka misses you, {$p->name}",
                'body' => "It has been a couple of days since your last visit. The pots are ready for your next shift!\n\nCome back for a quick round: serve your favourite dishes, check on your restaurant crew, and see how far you can climb today. Your saved progress is waiting for you.",
            ]);
        }
        return $count;
    }

    public static function deliver(int $limit = 100): array
    {
        $result = ['sent' => 0, 'failed' => 0, 'skipped' => 0];
        if (in_array(config('mail.default'), ['log', 'array'], true) && ! app()->runningUnitTests()) return $result;
        $rows = DB::table('mamaput_player_emails')->whereIn('status', ['pending', 'failed'])
            ->where('attempts', '<', 3)->where('available_at', '<=', now())->orderBy('id')->limit($limit)->get();
        foreach ($rows as $row) {
            $claimed = DB::table('mamaput_player_emails')->where('id', $row->id)->whereIn('status', ['pending', 'failed'])
                ->where('attempts', '<', 3)->where('available_at', '<=', now())
                ->update(['status' => 'sending', 'attempts' => DB::raw('attempts + 1'), 'updated_at' => now()]);
            if (! $claimed) continue;
            $p = MamaputPlayer::with(['user', 'vatarPlayer.user'])->find($row->player_id);
            if (! $p || ! self::allowed($p) || self::recipient($p) !== $row->recipient
                || ($row->kind === 'inactive' && ($p->last_seen_at ?? $p->created_at)->gt(now()->subDays(2)))) {
                DB::table('mamaput_player_emails')->where('id', $row->id)->update(['status' => 'skipped', 'updated_at' => now()]);
                $result['skipped']++;
                continue;
            }
            try {
                $payload = json_decode($row->payload, true);
                $lagos = $p->vatar_player_id !== null;
                Mail::to($row->recipient)->send(new PlayerNotice(
                    $p->name, $payload['title'], $payload['body'], 'Mama Put Rush',
                    $lagos ? 'https://lagoslife.app/' : 'https://mamaput-phi.vercel.app/',
                    $lagos ? 'Open Lagos Life and play' : 'Play Mama Put Rush',
                    URL::signedRoute('mamaput.email-preferences', ['player' => $p->id]),
                    URL::signedRoute('mamaput.email-unsubscribe', ['player' => $p->id]),
                ));
                DB::table('mamaput_player_emails')->where('id', $row->id)->update(['status' => 'sent', 'sent_at' => now(), 'updated_at' => now()]);
                $result['sent']++;
            } catch (Throwable $e) {
                report($e);
                $permanent = (bool) preg_match('/\b(?:550|551|553)\b/', $e->getMessage());
                DB::table('mamaput_player_emails')->where('id', $row->id)->update(['status' => $permanent ? 'rejected' : 'failed', 'available_at' => now()->addMinutes(15), 'updated_at' => now()]);
                $result['failed']++;
            }
        }
        return $result;
    }
}
