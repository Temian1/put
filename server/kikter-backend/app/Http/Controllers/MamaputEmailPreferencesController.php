<?php

namespace App\Http\Controllers;

use App\Models\MamaputPlayer;
use Illuminate\Support\Facades\URL;

class MamaputEmailPreferencesController extends Controller
{
    public function show(int $player)
    {
        MamaputPlayer::findOrFail($player);
        $url = e(URL::signedRoute('mamaput.email-unsubscribe', ['player' => $player]));
        return response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences</title><body style="font-family:Arial,sans-serif;background:#fff4df;padding:32px;color:#4a1f0c"><h1>Mama Put Rush emails</h1><p>Stop leaderboard and comeback emails? Your game progress will stay safe.</p><form method="post" action="'.$url.'"><button style="background:#0b675b;color:white;border:0;padding:14px 20px;border-radius:8px;font-size:16px">Stop game reminder emails</button></form></body></html>');
    }

    public function stop(int $player)
    {
        $p = MamaputPlayer::findOrFail($player);
        $p->email_opted_out_at = now();
        $p->save();
        return response('You have stopped Mama Put Rush leaderboard and comeback emails. Your game progress is unchanged.');
    }
}
