<?php

namespace Tests\Feature;

use App\Filament\Resources\MamaputPlayers\MamaputPlayerResource;
use App\Filament\Resources\MamaputPlayers\Pages\ManageMamaputPlayers;
use App\Filament\Resources\Users\Pages\ListUsers;
use App\Mail\PlayerNotice;
use App\Models\MamaputPlayer;
use App\Models\User;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Filament\Schemas\Schema;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Livewire\Livewire;
use Tests\TestCase;

class MamaputPlayerAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        config(['mail.default' => 'smtp']);
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $this->actingAs($admin);
        Filament::setCurrentPanel(array_values(Filament::getPanels())[0]);
    }

    private function playerWithEmail(string $email = 'ada@example.test'): MamaputPlayer
    {
        [$player] = MamaputPlayer::issue('Ada');
        $player->user_id = User::factory()->create(['email' => $email])->id;
        $player->save();

        return $player;
    }

    private function table()
    {
        return Livewire::test(ManageMamaputPlayers::class);
    }

    public function test_an_admin_can_email_a_player_from_the_dropdown(): void
    {
        $player = $this->playerWithEmail();
        $this->table()->callAction(TestAction::make('sendEmail')->table($player), [
            'subject' => 'Hello <b>there</b>', 'message' => "Line one\n<script>x</script>",
        ])->assertHasNoFormErrors();

        Mail::assertSent(PlayerNotice::class, function (PlayerNotice $mail): bool {
            $html = $mail->render();

            return $mail->hasTo('ada@example.test') && $mail->title === 'Hello <b>there</b>'
                && ! str_contains($html, '<script>') && str_contains($html, 'Line one<br');
        });
    }

    public function test_players_without_an_email_cannot_be_emailed_and_are_skipped_in_bulk(): void
    {
        [$guest] = MamaputPlayer::issue('Guest');
        $player = $this->playerWithEmail();
        $this->table()->assertActionHidden(TestAction::make('sendEmail')->table($guest));
        $this->table()->selectTableRecords([$guest->id, $player->id])
            ->callAction(TestAction::make('sendEmail')->table()->bulk(), ['subject' => 'News', 'message' => 'Hi']);
        Mail::assertSentCount(1);
    }

    public function test_a_ban_blocks_the_game_keeps_the_reason_and_can_tell_the_player(): void
    {
        $player = $this->playerWithEmail();
        $auth = ['Authorization' => 'Bearer '.$player->newToken()];
        $this->getJson('/api/mamaput/me', $auth)->assertOk();

        $this->table()->callAction(TestAction::make('ban')->table($player), ['reason' => 'Cheating', 'notify' => true])
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('mamaput_players', ['id' => $player->id, 'ban_reason' => 'Cheating']);
        $this->getJson('/api/mamaput/me', $auth)->assertForbidden();
        Mail::assertSent(PlayerNotice::class, fn (PlayerNotice $m): bool => str_contains($m->body, 'Cheating'));

        $this->table()->callAction(TestAction::make('unban')->table($player->fresh()), ['notify' => false]);
        $this->assertDatabaseHas('mamaput_players', ['id' => $player->id, 'banned_at' => null, 'ban_reason' => null]);
        $this->getJson('/api/mamaput/me', $auth)->assertOk();
        Mail::assertSentCount(1);
    }

    public function test_bulk_ban_and_unban(): void
    {
        [$a] = MamaputPlayer::issue('Aaa');
        [$b] = MamaputPlayer::issue('Bbb');
        $this->table()->selectTableRecords([$a->id, $b->id])
            ->callAction(TestAction::make('ban')->table()->bulk(), ['reason' => 'Bots']);
        $this->assertSame(2, MamaputPlayer::where('ban_reason', 'Bots')->count());
        $this->table()->selectTableRecords([$a->id, $b->id])
            ->callAction(TestAction::make('unban')->table()->bulk());
        $this->assertSame(0, MamaputPlayer::whereNotNull('banned_at')->count());
    }

    public function test_sign_out_everywhere_ends_every_session_and_spares_guests(): void
    {
        $player = $this->playerWithEmail();
        $token = $player->newToken();
        [$guest] = MamaputPlayer::issue('Guest');
        $this->table()->assertActionHidden(TestAction::make('signOut')->table($guest));
        $this->table()->callAction(TestAction::make('signOut')->table($player));
        $this->assertSame(0, DB::table('mamaput_tokens')->where('player_id', $player->id)->count());
        $this->getJson('/api/mamaput/me', ['Authorization' => 'Bearer '.$token])->assertUnauthorized();
    }

    public function test_the_view_action_shows_the_save_safely(): void
    {
        $player = $this->playerWithEmail();
        $player->forceFill(['save' => ['note' => '<script>x</script>']])->save();
        $page = $this->table()->instance();
        $html = MamaputPlayerResource::infolist(Schema::make($page)->record($player))->toHtml();
        $this->assertStringContainsString('&lt;script&gt;', $html);
        $this->assertStringNotContainsString('<script>x</script>', $html);
    }

    public function test_players_can_be_found_by_their_account_email(): void
    {
        $player = $this->playerWithEmail('findme@example.test');
        [$other] = MamaputPlayer::issue('Other');
        $this->table()->searchTable('findme@')
            ->assertCanSeeTableRecords([$player])->assertCanNotSeeTableRecords([$other]);
    }

    public function test_accounts_can_be_emailed_too(): void
    {
        $user = User::factory()->create(['email' => 'acct@example.test']);
        Livewire::test(ListUsers::class)
            ->callAction(TestAction::make('sendEmail')->table($user), ['subject' => 'Hi', 'message' => 'Body'])
            ->assertHasNoFormErrors();
        Mail::assertSent(PlayerNotice::class, fn (PlayerNotice $m): bool => $m->hasTo('acct@example.test'));
    }
}
