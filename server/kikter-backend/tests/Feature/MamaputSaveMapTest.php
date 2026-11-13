<?php

namespace Tests\Feature;

use App\Models\MamaputPlayer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MamaputSaveMapTest extends TestCase
{
    use RefreshDatabase;

    public function test_cloud_and_conflict_responses_encode_empty_maps_as_objects(): void
    {
        [$p] = MamaputPlayer::issue('Maeve');
        $p->user_id = User::factory()->create()->id;
        $p->syncFromSave(['coins' => 100000, 'unlocked' => 5, 'crew' => [], 'till' => [], 'equipBy' => ['ch0' => []]]);
        $p->save();
        $auth = ['Authorization' => 'Bearer '.$p->newToken()];
        $response = $this->getJson('/api/mamaput/save', $auth)->assertOk();
        $save = json_decode($response->getContent())->save;
        $this->assertInstanceOf(\stdClass::class, $save->crew);
        $this->assertInstanceOf(\stdClass::class, $save->till);
        $this->assertInstanceOf(\stdClass::class, $save->equipBy->ch0);
        $conflict = $this->putJson('/api/mamaput/save', ['version' => 999, 'save' => ['coins' => 100000, 'unlocked' => 5]], $auth)->assertConflict();
        $this->assertInstanceOf(\stdClass::class, json_decode($conflict->getContent())->save->crew);
        $this->putJson('/api/mamaput/save', ['version' => 0, 'save' => ['coins' => 55000, 'unlocked' => 5, 'crew' => ['ch0' => [['uid' => 'c1', 'job' => 'basira']]]]], $auth)->assertOk();
        $this->assertSame(1, $p->fresh()->staff_count);
        $this->getJson('/api/mamaput/save', $auth)->assertJsonPath('save.crew.ch0.0.job', 'basira');
    }
}
