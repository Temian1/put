<?php

namespace Tests\Feature;

use App\Filament\Resources\MamaputAirtime\Pages\ManageMamaputAirtime;
use App\Filament\Widgets\MamaputStatsOverview;
use App\MamaputAccounts;
use App\MamaputAirtime;
use App\Models\MamaputAirtimeEntry;
use App\Models\MamaputPlayer;
use App\Models\User;
use App\Models\VatarPlayer;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class MamaputAirtimeTest extends TestCase
{
    use RefreshDatabase;

    private int $n = 0;

    /** A signed-in Lagos Life player at a given level. */
    private function player(int $unlocked = 5, string $name = 'Ola'): array
    {
        $this->n++;
        [$p] = MamaputPlayer::issue($name);
        $p->vatar_player_id = VatarPlayer::create(['mode' => 'test', 'game_id' => 'g', 'player_id' => 'a'.$this->n, 'name' => $name])->id;
        $p->unlocked = $unlocked;
        $p->contact_email = 'player'.$this->n.'@example.test';
        $p->save();

        return [$p, ['Authorization' => 'Bearer '.$p->newToken()]];
    }

    private function asAdmin(): void
    {
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true])->save();
        $this->actingAs($admin);
        Filament::setCurrentPanel(array_values(Filament::getPanels())[0]);
    }

    public function test_numbers_are_normalised_and_networks_detected(): void
    {
        $this->assertSame('08031234567', MamaputAirtime::normalize('+234 803 123 4567'));
        $this->assertSame('08031234567', MamaputAirtime::normalize('2348031234567'));
        $this->assertSame('08031234567', MamaputAirtime::normalize('8031234567'));
        $this->assertSame('09051234567', MamaputAirtime::normalize('0905-123-4567'));
        $this->assertNull(MamaputAirtime::normalize('0803123456'));
        $this->assertNull(MamaputAirtime::normalize('01234567890'));
        $this->assertNull(MamaputAirtime::normalize('hello'));

        $this->assertSame('mtn', MamaputAirtime::detect('08031234567'));
        $this->assertSame('mtn', MamaputAirtime::detect('07025123456'));
        $this->assertSame('airtel', MamaputAirtime::detect('09121234567'));
        $this->assertSame('glo', MamaputAirtime::detect('08051234567'));
        $this->assertSame('9mobile', MamaputAirtime::detect('08091234567'));
        $this->assertNull(MamaputAirtime::detect('07021234567'));
    }

    public function test_email_is_required_before_a_phone_can_be_saved(): void
    {
        [$p, $auth] = $this->player(1);
        $p->contact_email = null; $p->save();
        $entry = ['phone' => '08031234567', 'network' => 'mtn'];
        $this->postJson('/api/mamaput/airtime', $entry, $auth)->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->assertSame(0, $p->airtime()->count());
        $p->contact_email = 'not-an-email'; $p->save();
        $this->postJson('/api/mamaput/airtime', $entry, $auth)->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->putJson('/api/mamaput/me/email', ['email' => 'ada@example.test'], $auth)->assertOk();
        $this->postJson('/api/mamaput/airtime', $entry, $auth)->assertOk();
        $this->assertSame(1, $p->airtime()->count());
    }

    public function test_a_linked_account_email_already_satisfies_the_requirement(): void
    {
        [$p, $auth] = $this->player(1);
        $p->contact_email = null;
        $p->user_id = User::factory()->create(['email' => 'ada@example.test'])->id;
        $p->save();
        $this->postJson('/api/mamaput/airtime', ['phone' => '08031234567', 'network' => 'mtn'], $auth)->assertOk();
    }

    public function test_a_player_saves_a_number_once_and_the_profile_shows_it(): void
    {
        [$p, $auth] = $this->player(12);
        $this->getJson('/api/mamaput/me', $auth)->assertOk()->assertJsonPath('airtime', null);

        $this->postJson('/api/mamaput/airtime', ['phone' => '0803 12', 'network' => 'mtn'], $auth)
            ->assertUnprocessable()->assertJsonValidationErrors('phone');
        $this->postJson('/api/mamaput/airtime', ['phone' => '08031234567', 'network' => 'vodafone'], $auth)
            ->assertUnprocessable()->assertJsonValidationErrors('network');

        $this->postJson('/api/mamaput/airtime', ['phone' => '+234 803 123 4567', 'network' => 'mtn'], $auth)
            ->assertOk()->assertJsonPath('airtime.phone', '0803****567')->assertJsonPath('airtime.status', 'pending');
        $this->assertDatabaseHas('mamaput_airtime_entries', [
            'player_id' => $p->id, 'phone' => '08031234567', 'network' => 'mtn', 'detected' => 'mtn', 'level_at_entry' => 12,
        ]);

        $this->postJson('/api/mamaput/airtime', ['phone' => '08051234567', 'network' => 'glo'], $auth)->assertStatus(409);
        $this->assertSame(1, MamaputAirtimeEntry::count());
    }

    public function test_a_ported_number_keeps_the_network_the_player_chose(): void
    {
        [$p, $auth] = $this->player();
        $this->postJson('/api/mamaput/airtime', ['phone' => '08031234567', 'network' => 'airtel'], $auth)->assertOk();
        $entry = $p->airtime()->sole();
        $this->assertSame('airtel', $entry->network);
        $this->assertSame('mtn', $entry->detected);
    }

    public function test_guests_and_banned_players_cannot_enter(): void
    {
        $this->postJson('/api/mamaput/airtime', ['phone' => '08031234567', 'network' => 'mtn'])->assertUnauthorized();
        [$p, $auth] = $this->player();
        $p->forceFill(['banned_at' => now()])->save();
        $this->postJson('/api/mamaput/airtime', ['phone' => '08031234567', 'network' => 'mtn'], $auth)->assertForbidden();
    }

    public function test_admins_mark_entries_sent_or_rejected_and_winners_hear_about_it(): void
    {
        [$a, $authA] = $this->player(56, 'Ada');
        [$b, $authB] = $this->player(60, 'Bisi');
        $this->postJson('/api/mamaput/airtime', ['phone' => '08031234567', 'network' => 'mtn'], $authA);
        $this->postJson('/api/mamaput/airtime', ['phone' => '08051234567', 'network' => 'glo'], $authB);
        $this->asAdmin();
        $ea = $a->airtime()->sole();
        $eb = $b->airtime()->sole();

        Livewire::test(ManageMamaputAirtime::class)->assertCanSeeTableRecords([$ea, $eb])
            ->callAction(TestAction::make('markSent')->table($ea));
        Livewire::test(ManageMamaputAirtime::class)->callAction(TestAction::make('reject')->table($eb));

        $this->assertSame('sent', $ea->fresh()->status);
        $this->assertNotNull($ea->fresh()->handled_at);
        $this->assertSame('rejected', $eb->fresh()->status);
        $this->getJson('/api/mamaput/inbox', $authA)->assertJsonPath('notes.0.type', 'airtime')
            ->assertJsonPath('notes.0.title', 'You won airtime! 📱');
        $this->assertSame(0, $b->notifications()->count());

        // Handled entries can be reopened, and only open ones can be marked.
        Livewire::test(ManageMamaputAirtime::class)
            ->assertActionHidden(TestAction::make('markSent')->table($ea->fresh()))
            ->callAction(TestAction::make('reopen')->table($eb->fresh()));
        $this->assertSame('pending', $eb->fresh()->status);
    }

    public function test_bulk_actions_skip_handled_entries(): void
    {
        [$a, $authA] = $this->player(56);
        [$b, $authB] = $this->player(56);
        $this->postJson('/api/mamaput/airtime', ['phone' => '08031234567', 'network' => 'mtn'], $authA);
        $this->postJson('/api/mamaput/airtime', ['phone' => '08051234567', 'network' => 'glo'], $authB);
        $a->airtime()->sole()->forceFill(['status' => 'rejected'])->save();
        $this->asAdmin();

        Livewire::test(ManageMamaputAirtime::class)
            ->selectTableRecords([$a->airtime->id, $b->airtime->id])
            ->callAction(TestAction::make('markSent')->table()->bulk());

        $this->assertSame('rejected', $a->airtime()->sole()->status);
        $this->assertSame('sent', $b->airtime()->sole()->status);
    }

    public function test_random_picks_come_only_from_players_at_the_draw_level(): void
    {
        $eligible = [];
        for ($i = 0; $i < 3; $i++) {
            [$p, $auth] = $this->player(55 + $i);
            $this->postJson('/api/mamaput/airtime', ['phone' => '0803123456'.$i, 'network' => 'mtn'], $auth);
            $eligible[] = $p->id;
        }
        [$low, $authLow] = $this->player(54);
        $this->postJson('/api/mamaput/airtime', ['phone' => '08059999999', 'network' => 'glo'], $authLow);
        [$banned, $authBan] = $this->player(50);
        $this->postJson('/api/mamaput/airtime', ['phone' => '08058888888', 'network' => 'glo'], $authBan);
        $banned->forceFill(['banned_at' => now()])->save();
        $this->asAdmin();

        Livewire::test(ManageMamaputAirtime::class)->callAction('pickWinners', ['count' => 10]);

        $picked = MamaputAirtimeEntry::where('status', 'picked')->pluck('player_id')->sort()->values()->all();
        $this->assertSame($eligible, $picked);
        $this->assertSame('pending', $low->airtime()->sole()->status);
        $this->assertSame('pending', $banned->airtime()->sole()->status);
    }

    public function test_stats_count_airtime_numbers_rewards_and_emails(): void
    {
        [$a, $authA] = $this->player(56, 'Ada');
        [$b, $authB] = $this->player(12, 'Bisi');
        [$c, $authC] = $this->player(60, 'Chi');
        foreach ([[$authA, '08031234567'], [$authB, '08051234567'], [$authC, '08091234567']] as [$auth, $phone]) {
            $this->postJson('/api/mamaput/airtime', ['phone' => $phone, 'network' => 'mtn'], $auth)->assertOk();
        }
        $a->airtime->forceFill(['status' => 'sent'])->save();
        $c->airtime->forceFill(['status' => 'picked'])->save();
        // Emails: one linked account, one typed in the game, one both (counted once).
        $a->user_id = User::factory()->create(['email' => 'ada@example.test'])->id;
        $a->save();
        $b->contact_email = 'bisi@example.test';
        $b->save();
        $c->user_id = User::factory()->create(['email' => 'chi@example.test'])->id;
        $c->contact_email = 'chi.typed@example.test';
        $c->save();
        $this->asAdmin();

        Livewire::test(MamaputStatsOverview::class)
            ->assertSeeInOrder(['Airtime numbers', '3', '2 reached level 55', '1 picked, not sent'])
            ->assertSeeInOrder(['Airtime rewarded', '1', '0 rejected'])
            ->assertSeeInOrder(['Players with email', '3', '2 from accounts', '1 typed in the game']);
    }

    public function test_merging_accounts_keeps_the_airtime_entry(): void
    {
        [$from] = MamaputPlayer::issue('Device');
        $from->airtime()->create(['phone' => '08031234567', 'network' => 'mtn']);
        $user = User::factory()->create();
        [$into] = MamaputPlayer::issue('Main');
        $into->user_id = $user->id;
        $into->save();

        $merged = MamaputAccounts::signIn($from, $user, null);

        $this->assertSame('08031234567', $merged->fresh()->airtime->phone);
    }
}
