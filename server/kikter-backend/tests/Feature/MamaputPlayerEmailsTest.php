<?php

namespace Tests\Feature;

use App\Mail\PlayerNotice;
use App\MamaputInbox;
use App\MamaputPlayerEmails;
use App\Models\MamaputPlayer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class MamaputPlayerEmailsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    private function player(string $email, bool $contact = false, int $days = 3): MamaputPlayer
    {
        [$p] = MamaputPlayer::issue('Ada');
        $p->user_id = User::factory()->create()->id;
        if ($contact) {
            $p->user->email = null;
            $p->user->save();
            $p->contact_email = $email;
        } else {
            $p->user->email = $email;
            $p->user->save();
        }
        $p->last_seen_at = now()->subDays($days);
        $p->lifetime_sales = 500;
        $p->save();
        return $p->fresh();
    }

    public function test_account_and_contact_addresses_receive_one_reminder_per_absence(): void
    {
        $a = $this->player('account@example.test');
        $this->player('contact@example.test', true);
        $this->player('recent@example.test', false, 1);
        $banned = $this->player('banned@example.test');
        $banned->banned_at = now(); $banned->save();
        $this->assertSame(2, MamaputPlayerEmails::inactivity());
        $this->assertSame(0, MamaputPlayerEmails::inactivity());
        $this->assertSame(2, MamaputPlayerEmails::deliver()['sent']);
        Mail::assertSent(PlayerNotice::class, fn ($mail) => $mail->hasTo('contact@example.test'));
        Mail::assertSentCount(2);
        MamaputPlayerEmails::deliver(); Mail::assertSentCount(2);
        $a->last_seen_at = now(); $a->save();
        $this->travel(49)->hours();
        // Ada's new absence and the previously recent player are now eligible.
        $this->assertSame(2, MamaputPlayerEmails::inactivity());
    }

    public function test_overtakes_email_contact_users_below_the_top_fifty_and_dedupe_by_board_and_day(): void
    {
        $a = $this->player('ada@example.test', true);
        for ($i = 0; $i < 51; $i++) {
            [$top] = MamaputPlayer::issue('Top');
            $top->user_id = User::factory()->create()->id;
            $top->lifetime_sales = 10000; $top->save();
        }
        $b = $this->player('bisi@example.test');
        $b->lifetime_sales = 700; $b->save();
        MamaputPlayerEmails::passed($b, ['lifetime_sales' => 100]);
        MamaputPlayerEmails::passed($b, ['lifetime_sales' => 100]);
        $this->assertSame(1, DB::table('mamaput_player_emails')->count());
        MamaputPlayerEmails::deliver();
        Mail::assertSent(PlayerNotice::class, fn ($mail) => $mail->hasTo('ada@example.test') && str_contains($mail->body, '#53'));
    }

    public function test_save_endpoint_records_the_email_without_sending_it_during_the_save(): void
    {
        $this->player('ada@example.test');
        $b = $this->player('bisi@example.test');
        $b->lifetime_sales = 100; $b->save();
        $this->putJson('/api/mamaput/save', ['version' => 0, 'save' => ['coins' => 500, 'unlocked' => 2, 'stats' => ['earn' => 700]]], ['Authorization' => 'Bearer '.$b->newToken()])->assertOk();
        $this->assertSame(1, DB::table('mamaput_player_emails')->where('kind', 'passed')->count());
        Mail::assertNothingSent();
    }

    public function test_returning_before_delivery_cancels_the_stale_reminder(): void
    {
        $p = $this->player('ada@example.test');
        MamaputPlayerEmails::inactivity();
        $p->last_seen_at = now(); $p->save();
        $this->assertSame(1, MamaputPlayerEmails::deliver()['skipped']);
        Mail::assertNothingSent();
    }

    public function test_shared_address_is_not_reminded_when_one_profile_is_active(): void
    {
        $this->player('same@example.test', true);
        $this->player('same@example.test', true, 0);
        $this->assertSame(0, MamaputPlayerEmails::inactivity());
    }

    public function test_unsubscribe_is_signed_and_get_does_not_change_preferences(): void
    {
        $p = $this->player('ada@example.test');
        $this->get(URL::signedRoute('mamaput.email-preferences', ['player' => $p->id]))->assertOk();
        $this->assertNull($p->fresh()->email_opted_out_at);
        $this->post('/api/mamaput/email-unsubscribe/'.$p->id)->assertForbidden();
        $this->post(URL::signedRoute('mamaput.email-unsubscribe', ['player' => $p->id]))->assertOk();
        $this->assertNotNull($p->fresh()->email_opted_out_at);
        $this->assertSame(0, MamaputPlayerEmails::inactivity());
    }

    public function test_template_is_inline_styled_escaped_and_has_a_plain_text_alternative(): void
    {
        $m = new PlayerNotice('Ada <script>', 'Your comeback', "Fresh food\n<script>alert(1)</script>", 'Mama Put Rush', 'https://lagoslife.app/', 'Play now', 'https://example.test/preferences', 'https://example.test/stop');
        $html = $m->render();
        $this->assertStringContainsString('role="presentation"', $html);
        $this->assertStringContainsString('text-decoration:none !important', $html);
        $this->assertStringContainsString('&lt;script&gt;', $html);
        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringNotContainsString('<link', $html);
        $this->assertStringContainsString('Play Mama Put Rush: https://mamaput-phi.vercel.app/', view('mail.player-notice-text', $m->buildViewData())->render());
        $this->assertArrayHasKey('List-Unsubscribe', $m->headers()->text);
    }

    public function test_dry_run_and_invalid_addresses_do_not_send_or_create_email_jobs(): void
    {
        $this->player('ada@example.test');
        $this->player('not-an-address', true);
        $this->assertSame(1, MamaputPlayerEmails::inactivity(true));
        $this->assertSame(0, DB::table('mamaput_player_emails')->count());
        Mail::assertNothingSent();
    }

    public function test_failed_delivery_waits_before_retry_and_stops_after_three_attempts(): void
    {
        $this->player('ada@example.test');
        MamaputPlayerEmails::inactivity();
        Mail::shouldReceive('to')->times(3)->andThrow(new \RuntimeException('Test transport unavailable'));
        for ($i = 0; $i < 3; $i++) {
            $this->assertSame(1, MamaputPlayerEmails::deliver()['failed']);
            $this->assertSame(0, MamaputPlayerEmails::deliver()['failed']);
            $this->travel(16)->minutes();
        }
        $this->assertSame(0, MamaputPlayerEmails::deliver()['failed']);
        $this->assertSame(3, DB::table('mamaput_player_emails')->value('attempts'));
    }

    public function test_permanently_rejected_addresses_are_not_retried(): void
    {
        $this->player('ada@example.test');
        MamaputPlayerEmails::inactivity();
        Mail::shouldReceive('to')->once()->andThrow(new \RuntimeException('550 Recipient not found'));
        $this->assertSame(1, MamaputPlayerEmails::deliver()['failed']);
        $this->assertSame('rejected', DB::table('mamaput_player_emails')->value('status'));
        $this->travel(16)->minutes();
        $this->assertSame(0, MamaputPlayerEmails::deliver()['failed']);
    }

    public function test_lagos_life_players_and_announcement_emails_link_directly_to_the_game(): void
    {
        $p = $this->player('ada@example.test', true);
        $p->vatar_player_id = \App\Models\VatarPlayer::create(['mode' => 'test', 'game_id' => 'g', 'player_id' => 'direct-game-link', 'name' => 'Ada'])->id;
        $p->save();
        MamaputPlayerEmails::inactivity();
        MamaputPlayerEmails::deliver();
        Mail::assertSent(PlayerNotice::class, fn ($m) => $m->actionUrl === 'https://mamaput-phi.vercel.app/' && $m->actionLabel === 'Play Mama Put Rush');
        $announcement = new PlayerNotice('Ada', 'New airtime feature', 'Come and play', 'Mama Put Rush');
        $this->assertStringContainsString('href="https://mamaput-phi.vercel.app/"', $announcement->render());
        $this->assertStringNotContainsString('href="https://lagoslife.app/', $announcement->render());
    }
}
