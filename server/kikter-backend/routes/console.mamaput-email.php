<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('mamaput:player-emails --limit=100')
    ->everyMinute()->withoutOverlapping(10)
    ->appendOutputTo(storage_path('logs/mamaput-player-emails.log'));
