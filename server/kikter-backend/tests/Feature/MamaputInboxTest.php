<?php

namespace Tests\Feature;

use App\Filament\Resources\MamaputAnnouncements\Pages\ManageMamaputAnnouncements;
use App\Filament\Resources\MamaputMessages\Pages\ManageMamaputMessages;
use App\Mail\PlayerNotice;
use App\MamaputAccounts;
use App\MamaputInbox;
use App\Models\MamaputAnnouncement;
use App\Models\MamaputNotification;
use App\Models\MamaputPlayer;
use App\Models\User;
use App\Models\VatarPlayer;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Livewire\Livewire;
use Tests\TestCase;

class MamaputInboxTest extends TestCase
{
    use RefreshDatabase;

    private int $n = 0;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    /** A signed-in Lagos Life player with a sales total. */
    private function player(string $name, int $sales = 0): array
    {
        $this->n++;
        [$p] = MamaputPlayer::issue($name);
        $p->vatar_player_id = VatarPlayer::create(['mode' => 'test', 'game_id' => 'g', 'player_id' => 'p'.$this->n, 'name' => $name])->id;
        $p->lifetime_sales = $sales;
        $p->save();

        return [$p, ['Authorization' => 'Bearer '.$p->newToken()]];
    }

    private function upload(array $auth, int $sales, int $version): void
    {
        $this->putJson('/api/mamaput/save', ['version' => $version, 'save' => [
            'unlocked' => 5, 'coins' => 100, 'stats' => ['earn' => $sales],
        ]], $auth)->assertOk();
    }

    private function asAdmin(): void
    {
        config(['mail.default' => 'smtp']);
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $this->actingAs($admin);
        Filament::setCurrentPanel(array_values(Filament::getPanels())[0]);
    }

    public function test_passing_a_top_player_alerts_them_once_a_day(): void
    {
        [$ada] = $this->player('Ada', 5000);
        [, $auth] = $this->player('Bisi', 1000);

        $this->upload($auth, 6000, 0);
        $note = $ada->notifications()->sole();
        $this->assertSame('passed', $note->type);
        $this->assertSame('Bisi passed you on Top Bukas', $note->title);
        $this->assertStringContainsString('#2', $note->body);

        // Ada takes it back and Bisi passes again: still one alert today.
        $ada->forceFill(['lifetime_sales' => 7000])->save();
        $this->upload($auth, 8000, 1);
        $this->assertSame(1, $ada->notifications()->count());
    }

    public function test_only_players_in_the_top_fifty_are_alerted(): void
    {
        [$low] = $this->player('Low', 100);
        for ($i = 0; $i < MamaputInbox::TOP; $i++) {
            $this->player('Top'.$i, 10000 + $i);
        }
        [, $auth] = $this->player('Climber', 50);

        $this->upload($auth, 200, 0);
        $this->assertSame(0, $low->notifications()->count());
    }

    public function test_banned_players_and_guests_are_left_out(): void
    {
        [$banned] = $this->player('Banned', 5000);
        $banned->forceFill(['banned_at' => now()])->save();
        [$guest] = MamaputPlayer::issue('Guest');
        $guest->forceFill(['lifetime_sales' => 5000])->save();
        [, $auth] = $this->player('Bisi', 1000);

        $this->upload($auth, 6000, 0);
        $this->assertSame(0, MamaputNotification::count());
    }

    public function test_the_passed_player_can_answer_once_and_the_rival_can_answer_back(): void
    {
        [$ada, $adaAuth] = $this->player('Ada', 5000);
        [$bisi, $bisiAuth] = $this->player('Bisi', 1000);
        $this->upload($bisiAuth, 6000, 0);
        $alert = $this->getJson('/api/mamaput/inbox', $adaAuth)->assertOk()
            ->assertJsonPath('unread', 1)->assertJsonPath('notes.0.canReply', true)
            ->assertJsonPath('notes.0.board', 'sales')->json('notes.0.id');

        $this->postJson("/api/mamaput/inbox/{$alert}/reply", ['message' => 'I go collect am back 😤🔥'], $adaAuth)
            ->assertOk()->assertJsonPath('notes.0.canReply', false);
        $this->postJson("/api/mamaput/inbox/{$alert}/reply", ['message' => 'again'], $adaAuth)->assertUnprocessable();

        $msg = $bisi->notifications()->sole();
        $this->assertSame('message', $msg->type);
        $this->assertSame('I go collect am back 😤🔥', $msg->body);
        $this->postJson("/api/mamaput/inbox/{$msg->id}/reply", ['message' => 'Try am 😂'], $bisiAuth)->assertOk();
        $this->assertSame('Try am 😂', $ada->notifications()->where('type', 'message')->sole()->body);
    }

    public function test_messages_are_short_and_cleaned(): void
    {
        $this->assertSame('you ***** lol', MamaputInbox::clean('you  werey lol'));
        $this->assertSame('visit', MamaputInbox::clean('visit https://scam.example/x www.bad.ng promo.com'));
        $this->assertSame(MamaputInbox::MESSAGE_LENGTH, mb_strlen(MamaputInbox::clean(str_repeat('😀', 200))));

        [$ada, $adaAuth] = $this->player('Ada', 5000);
        [, $bisiAuth] = $this->player('Bisi', 1000);
        $this->upload($bisiAuth, 6000, 0);
        $id = $ada->notifications()->sole()->id;
        $this->postJson("/api/mamaput/inbox/{$id}/reply", ['message' => 'https://x.example'], $adaAuth)->assertUnprocessable();
    }

    public function test_a_muted_rival_cannot_message_you(): void
    {
        [$ada, $adaAuth] = $this->player('Ada', 5000);
        [$bisi, $bisiAuth] = $this->player('Bisi', 1000);
        $this->upload($bisiAuth, 6000, 0);
        $alert = $ada->notifications()->sole();
        $this->postJson("/api/mamaput/inbox/{$alert->id}/mute", [], $adaAuth)->assertOk();

        $note = $ada->notifications()->create(['type' => 'message', 'from_player_id' => $ada->id, 'title' => 't', 'body' => 'b']);
        $bisiNote = $bisi->notifications()->create(['type' => 'message', 'from_player_id' => $ada->id, 'title' => 'Ada', 'body' => 'hi']);
        $this->postJson("/api/mamaput/inbox/{$bisiNote->id}/reply", ['message' => 'You no fit'], $bisiAuth)->assertOk();
        $this->assertSame(0, $ada->notifications()->where('from_player_id', $bisi->id)->where('type', 'message')->count());
        $this->assertNotNull($note);
    }

    public function test_inboxes_are_private(): void
    {
        [$ada] = $this->player('Ada', 5000);
        [, $bisiAuth] = $this->player('Bisi', 1000);
        $note = $ada->notifications()->create(['type' => 'announcement', 'title' => 'Hi', 'body' => 'b', 'reward_coins' => 50]);
        $this->postJson("/api/mamaput/inbox/{$note->id}/claim", [], $bisiAuth)->assertNotFound();
        $this->postJson("/api/mamaput/inbox/{$note->id}/reply", ['message' => 'x'], $bisiAuth)->assertNotFound();
        $this->getJson('/api/mamaput/inbox')->assertUnauthorized();
    }

    public function test_an_announcement_reaches_its_audience_and_its_coins_are_paid_once(): void
    {
        [$ada, $adaAuth] = $this->player('Ada');
        [$bisi] = $this->player('Bisi');
        [$guest] = MamaputPlayer::issue('Guest');
        [$kikter] = MamaputPlayer::issue('Kikter only');
        $kikter->user_id = User::factory()->create(['email' => 'k@example.test'])->id;
        $kikter->save();

        $a = MamaputInbox::announce(['title' => 'Promo', 'body' => 'Free coins', 'audience' => 'lagoslife', 'reward_coins' => 25], null);
        $this->assertSame(2, $a->sent_count);
        $this->assertSame(1, $bisi->notifications()->count());
        $this->assertSame(0, $guest->notifications()->count() + $kikter->notifications()->count());

        $id = $this->getJson('/api/mamaput/me', $adaAuth)->assertJsonPath('inboxUnread', 1)->json('id');
        $this->assertNotNull($id);
        $note = $ada->notifications()->sole();
        $this->postJson("/api/mamaput/inbox/{$note->id}/claim", [], $adaAuth)
            ->assertOk()->assertJsonPath('coins', 25)->assertJsonPath('wallet.coins', 25)->assertJsonPath('notes.0.claimed', true);
        $this->postJson("/api/mamaput/inbox/{$note->id}/claim", [], $adaAuth)->assertUnprocessable();
        $this->assertSame(25, MamaputAccounts::balance($ada->fresh()));

        $this->postJson('/api/mamaput/inbox/read', [], $adaAuth)->assertOk();
        $this->getJson('/api/mamaput/me', $adaAuth)->assertJsonPath('inboxUnread', 0);
    }

    public function test_admins_send_announcements_from_filament_with_an_email_copy(): void
    {
        [$ada] = $this->player('Ada');
        $ada->contact_email = 'ada@example.test';
        $ada->save();
        $this->asAdmin();

        Livewire::test(ManageMamaputAnnouncements::class)
            ->callAction('create', ['title' => 'Big update', 'body' => 'New levels!', 'audience' => 'all', 'reward_coins' => 0, 'email' => true])
            ->assertHasNoFormErrors();

        $this->assertSame(1, MamaputAnnouncement::sole()->sent_count);
        $this->assertSame('Big update', $ada->notifications()->sole()->title);
        Mail::assertSent(PlayerNotice::class, fn (PlayerNotice $m): bool => $m->hasTo('ada@example.test'));
    }

    public function test_one_player_announcements_and_deleting_removes_them(): void
    {
        [$ada] = $this->player('Ada');
        [$bisi] = $this->player('Bisi');
        $a = MamaputInbox::announce(['title' => 'Just you', 'body' => 'Hi', 'audience' => 'player', 'player_id' => $ada->id], null);
        $this->assertSame(1, $ada->notifications()->count());
        $this->assertSame(0, $bisi->notifications()->count());
        $a->delete();
        $this->assertSame(0, $ada->notifications()->count());
    }

    public function test_admins_can_ban_an_abusive_sender(): void
    {
        [$ada] = $this->player('Ada');
        [$bisi] = $this->player('Bisi');
        $msg = $ada->notifications()->create(['type' => 'message', 'from_player_id' => $bisi->id, 'title' => 'Bisi sent you a message', 'body' => 'rude']);
        $this->asAdmin();

        Livewire::test(ManageMamaputMessages::class)->assertCanSeeTableRecords([$msg])
            ->callAction(TestAction::make('banSender')->table($msg));
        $this->assertSame('Abusive messages', $bisi->fresh()->ban_reason);
    }

    public function test_a_support_reply_lands_in_the_inbox(): void
    {
        [$ada, $auth] = $this->player('Ada');
        $ticket = $ada->tickets()->create(['category' => 'request']);
        $ticket->addReply(null, 'We fixed it');
        $this->getJson('/api/mamaput/inbox', $auth)->assertJsonPath('notes.0.type', 'support')
            ->assertJsonPath('notes.0.body', 'We fixed it');
    }
}
