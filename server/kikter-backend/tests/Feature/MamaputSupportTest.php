<?php

namespace Tests\Feature;

use App\Filament\Resources\MamaputPlayers\Pages\ManageMamaputPlayers;
use App\Filament\Resources\MamaputTickets\MamaputTicketResource;
use App\Filament\Resources\MamaputTickets\Pages\ManageMamaputTickets;
use App\Mail\PlayerNotice;
use App\MamaputAccounts;
use App\Models\MamaputPlayer;
use App\Models\MamaputTicket;
use App\Models\User;
use App\Models\VatarPlayer;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Filament\Schemas\Schema;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Livewire\Livewire;
use Tests\TestCase;

class MamaputSupportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    private function vatar(string $id): VatarPlayer
    {
        return VatarPlayer::create(['mode' => 'test', 'game_id' => 'game', 'player_id' => $id, 'name' => 'Vatar '.$id]);
    }

    /** A Lagos Life player: signed in, with no email anywhere. */
    private function lagosPlayer(string $id = 'a'): array
    {
        [$player] = MamaputPlayer::issue('Ola');
        $player->vatar_player_id = $this->vatar($id)->id;
        $player->save();

        return [$player, ['Authorization' => 'Bearer '.$player->newToken()]];
    }

    private function asAdmin(): User
    {
        config(['mail.default' => 'smtp']);
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $this->actingAs($admin);
        Filament::setCurrentPanel(array_values(Filament::getPanels())[0]);

        return $admin;
    }

    public function test_a_player_without_an_email_can_save_one_with_no_verification(): void
    {
        [$player, $auth] = $this->lagosPlayer();
        $this->getJson('/api/mamaput/me', $auth)->assertOk()->assertJsonPath('email', null);

        $this->putJson('/api/mamaput/me/email', ['email' => 'not-an-email'], $auth)->assertUnprocessable();
        $this->putJson('/api/mamaput/me/email', ['email' => ' Ola@Example.TEST '], $auth)
            ->assertOk()->assertJsonPath('email', 'ola@example.test');

        $this->assertDatabaseHas('mamaput_players', ['id' => $player->id, 'contact_email' => 'ola@example.test']);
        $this->getJson('/api/mamaput/me', $auth)->assertJsonPath('email', 'ola@example.test');
        Mail::assertNothingSent();
    }

    public function test_the_contact_email_never_touches_login_emails(): void
    {
        $owner = User::factory()->create(['email' => 'taken@example.test']);
        [$player, $auth] = $this->lagosPlayer();

        // Two players may share a contact email; it is not an identity.
        $this->putJson('/api/mamaput/me/email', ['email' => 'taken@example.test'], $auth)->assertOk();
        $this->assertSame('taken@example.test', $owner->fresh()->email);
        $this->assertNull($player->fresh()->user_id);
        $this->assertSame(1, User::where('email', 'taken@example.test')->count());
    }

    public function test_an_account_email_is_kept_over_a_typed_one(): void
    {
        [$player, $auth] = $this->lagosPlayer();
        $player->user_id = User::factory()->create(['email' => 'real@example.test'])->id;
        $player->save();

        $this->putJson('/api/mamaput/me/email', ['email' => 'other@example.test'], $auth)
            ->assertOk()->assertJsonPath('email', 'real@example.test');
        $this->assertNull($player->fresh()->contact_email);
    }

    public function test_a_banned_player_cannot_save_an_email_or_write_to_support(): void
    {
        [$player, $auth] = $this->lagosPlayer();
        $player->forceFill(['banned_at' => now()])->save();
        $this->putJson('/api/mamaput/me/email', ['email' => 'a@example.test'], $auth)->assertForbidden();
        $this->postJson('/api/mamaput/support', ['category' => 'request', 'message' => 'Please help me'], $auth)->assertForbidden();
    }

    public function test_a_player_can_send_a_ticket_and_support_is_alerted(): void
    {
        [$player, $auth] = $this->lagosPlayer();
        $this->postJson('/api/mamaput/support', ['category' => 'nonsense', 'message' => 'Please help me'], $auth)->assertUnprocessable();
        $this->postJson('/api/mamaput/support', ['category' => 'request', 'message' => 'hi'], $auth)->assertUnprocessable();

        $this->postJson('/api/mamaput/support', ['category' => 'complaint', 'message' => 'My coins vanished'], $auth)
            ->assertCreated()->assertJsonPath('tickets.0.category', 'complaint')
            ->assertJsonPath('tickets.0.status', 'open')
            ->assertJsonPath('tickets.0.messages.0.body', 'My coins vanished')
            ->assertJsonPath('tickets.0.messages.0.support', false);

        $this->assertDatabaseHas('mamaput_tickets', ['player_id' => $player->id, 'category' => 'complaint']);
        Mail::assertSent(PlayerNotice::class, fn (PlayerNotice $m): bool => $m->hasTo(config('mail.from.address')) && str_contains($m->body, 'My coins vanished'));
    }

    public function test_tickets_are_private_to_their_player(): void
    {
        [, $auth] = $this->lagosPlayer('a');
        [, $other] = $this->lagosPlayer('b');
        $id = $this->postJson('/api/mamaput/support', ['category' => 'request', 'message' => 'Mine alone'], $auth)->json('tickets.0.id');

        $this->getJson('/api/mamaput/support', $other)->assertOk()->assertJsonCount(0, 'tickets');
        $this->postJson("/api/mamaput/support/{$id}/reply", ['message' => 'Sneaking in'], $other)->assertNotFound();
        $this->getJson('/api/mamaput/support')->assertUnauthorized();
    }

    public function test_a_player_cannot_flood_support_with_open_tickets(): void
    {
        [$player, $auth] = $this->lagosPlayer();
        for ($i = 0; $i < MamaputTicket::MAX_OPEN; $i++) {
            $ticket = $player->tickets()->create(['category' => 'request']);
            $ticket->addPlayerMessage('Old message');
        }
        $this->postJson('/api/mamaput/support', ['category' => 'request', 'message' => 'One too many'], $auth)->assertStatus(429);
    }

    public function test_an_admin_reply_reaches_the_game_and_the_email_a_player_typed(): void
    {
        [$player, $auth] = $this->lagosPlayer();
        $this->putJson('/api/mamaput/me/email', ['email' => 'ola@example.test'], $auth);
        $id = $this->postJson('/api/mamaput/support', ['category' => 'problem', 'message' => 'Game froze'], $auth)->json('tickets.0.id');
        Mail::forgetMailers();
        Mail::fake();

        $this->asAdmin();
        Livewire::test(ManageMamaputTickets::class)
            ->callAction(TestAction::make('reply')->table(MamaputTicket::find($id)), ['message' => 'Update the game', 'notify' => true])
            ->assertHasNoFormErrors();

        Mail::assertSent(PlayerNotice::class, fn (PlayerNotice $m): bool => $m->hasTo('ola@example.test') && $m->body === 'Update the game');
        $this->getJson('/api/mamaput/me', $auth)->assertJsonPath('supportUnread', 1);
        $this->getJson('/api/mamaput/support', $auth)->assertJsonPath('tickets.0.status', 'answered')
            ->assertJsonPath('tickets.0.unread', true)
            ->assertJsonPath('tickets.0.messages.1.support', true)
            ->assertJsonPath('tickets.0.messages.1.body', 'Update the game');

        $this->postJson('/api/mamaput/support/read', [], $auth)->assertOk();
        $this->getJson('/api/mamaput/me', $auth)->assertJsonPath('supportUnread', 0);
    }

    public function test_a_player_reply_reopens_a_ticket_but_not_a_closed_one(): void
    {
        [, $auth] = $this->lagosPlayer();
        $id = $this->postJson('/api/mamaput/support', ['category' => 'account', 'message' => 'First message'], $auth)->json('tickets.0.id');
        $ticket = MamaputTicket::find($id);
        $ticket->addReply(null, 'Answer');

        $this->postJson("/api/mamaput/support/{$id}/reply", ['message' => 'One more thing'], $auth)
            ->assertOk()->assertJsonPath('tickets.0.status', 'open')->assertJsonCount(3, 'tickets.0.messages');

        $ticket->close();
        $this->postJson("/api/mamaput/support/{$id}/reply", ['message' => 'Too late now'], $auth)->assertUnprocessable();
    }

    public function test_admin_can_close_and_reopen_from_the_dropdown(): void
    {
        [, $auth] = $this->lagosPlayer();
        $id = $this->postJson('/api/mamaput/support', ['category' => 'other', 'message' => 'Hello there'], $auth)->json('tickets.0.id');
        $this->asAdmin();
        $ticket = MamaputTicket::find($id);

        Livewire::test(ManageMamaputTickets::class)->callAction(TestAction::make('close')->table($ticket));
        $this->assertSame('closed', $ticket->fresh()->status);
        Livewire::test(ManageMamaputTickets::class)->callAction(TestAction::make('reopen')->table($ticket->fresh()));
        $this->assertSame('open', $ticket->fresh()->status);
    }

    public function test_the_conversation_view_renders_and_escapes_messages(): void
    {
        [$player] = $this->lagosPlayer();
        $ticket = $player->tickets()->create(['category' => 'request']);
        $ticket->addPlayerMessage('<script>x</script>');
        $this->asAdmin();
        Livewire::test(ManageMamaputTickets::class)->assertCanSeeTableRecords([$ticket]);

        $page = Livewire::test(ManageMamaputTickets::class)->instance();
        $html = MamaputTicketResource::infolist(
            Schema::make($page)->record($ticket->load('messages'))
        )->toHtml();
        $this->assertStringContainsString('&lt;script&gt;', $html);
        $this->assertStringNotContainsString('<script>x</script>', $html);
    }

    public function test_players_with_a_typed_email_can_be_emailed_and_filtered(): void
    {
        [$player] = $this->lagosPlayer('a');
        $player->contact_email = 'typed@example.test';
        $player->save();
        [$none] = $this->lagosPlayer('b');
        $this->asAdmin();

        Livewire::test(ManageMamaputPlayers::class)
            ->filterTable('email')
            ->assertCanSeeTableRecords([$player])->assertCanNotSeeTableRecords([$none])
            ->searchTable('typed@')->assertCanSeeTableRecords([$player]);

        Livewire::test(ManageMamaputPlayers::class)
            ->callAction(TestAction::make('sendEmail')->table($player), ['subject' => 'Hi', 'message' => 'Body'])
            ->assertHasNoFormErrors();
        Mail::assertSent(PlayerNotice::class, fn (PlayerNotice $m): bool => $m->hasTo('typed@example.test'));
    }

    public function test_merging_accounts_keeps_tickets_and_the_typed_email(): void
    {
        [$from] = MamaputPlayer::issue('Guest device');
        $from->contact_email = 'keep@example.test';
        $from->save();
        $ticket = $from->tickets()->create(['category' => 'request']);
        $ticket->addPlayerMessage('Do not lose me');
        $user = User::factory()->create();
        [$into] = MamaputPlayer::issue('Main');
        $into->user_id = $user->id;
        $into->save();

        $merged = MamaputAccounts::signIn($from, $user, null);

        $this->assertSame($into->id, $merged->id);
        $this->assertSame($into->id, $ticket->fresh()?->player_id);
        $this->assertSame('keep@example.test', $merged->fresh()->contact_email);
    }
}
