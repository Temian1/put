<?php

namespace App\Console\Commands;

use App\MamaputAccounts;
use App\Models\MamaputPlayer;
use Illuminate\Console\Command;

class RegisterMamaputPlatformAccounts extends Command
{
    protected $signature = 'mamaput:register-platform-accounts';

    protected $description = 'Register existing verified Lagos Life players in Users without inventing email addresses or changing game wallets';

    public function handle(): int
    {
        $registered = 0;
        MamaputPlayer::whereNotNull('vatar_player_id')->with(['vatarPlayer.user', 'user'])
            ->chunkById(100, function ($players) use (&$registered): void {
                foreach ($players as $player) {
                    if (! $player->vatarPlayer) continue;
                    $wasRegistered = $player->vatarPlayer->user_id !== null;
                    MamaputAccounts::registerPlatformIdentity($player->vatarPlayer, $player->user);
                    if (! $wasRegistered) $registered++;
                }
            });
        $this->info('Platform account mappings added: '.$registered);

        return self::SUCCESS;
    }
}
