<?php

namespace App\Console\Commands;

use App\MamaputPlayerEmails;
use Illuminate\Console\Command;

class SendMamaputPlayerEmails extends Command
{
    protected $signature = 'mamaput:player-emails {--limit=100} {--dry-run}';

    protected $description = 'Send deduplicated leaderboard and two-day comeback emails';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $new = MamaputPlayerEmails::inactivity($dry);
        $result = $dry ? [] : MamaputPlayerEmails::deliver(max(1, min(200, (int) $this->option('limit'))));
        $this->line(json_encode(['dry_run' => $dry, 'new_reminders' => $new] + $result));
        return ($result['failed'] ?? 0) ? self::FAILURE : self::SUCCESS;
    }
}
