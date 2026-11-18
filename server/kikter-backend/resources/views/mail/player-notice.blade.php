<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{{ $title }}</title></head>
<body style="margin:0;padding:0;background-color:#fff4df;color:#4a1f0c;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fff4df" style="width:100%;background-color:#fff4df;border-collapse:collapse;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;border-collapse:separate;">
<tr><td bgcolor="#4a1f0c" style="padding:24px 28px;background-color:#4a1f0c;border-radius:16px 16px 0 0;">
<p style="margin:0;color:#ffc531;font-size:12px;line-height:18px;font-weight:bold;letter-spacing:2px;">{{ $team }}</p>
<p style="margin:8px 0 0;color:#ffffff;font-size:24px;line-height:32px;font-weight:bold;">{{ $team === 'Mama Put Rush' ? 'Your next great shift awaits.' : 'A message from '.$team }}</p>
</td></tr>
<tr><td bgcolor="#ffffff" style="padding:28px;background-color:#ffffff;border-bottom:4px solid #ffc531;border-radius:0 0 16px 16px;">
<h1 style="margin:0 0 20px;font-size:22px;line-height:30px;font-weight:bold;color:#4a1f0c;">{{ $title }}</h1>
<p style="margin:0 0 14px;font-size:16px;line-height:26px;color:#4a1f0c;">Hi {{ $playerName }},</p>
<p style="margin:0 0 24px;font-size:16px;line-height:26px;color:#4a1f0c;">{!! nl2br(e($body)) !!}</p>
@if($actionUrl)
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:0 0 24px;"><tr>
<td align="center" bgcolor="#0b675b" style="background-color:#0b675b;border:1px solid #0b675b;border-radius:10px;">
<a href="{{ $actionUrl }}" target="_blank" style="display:inline-block;padding:15px 24px;border:0;border-radius:10px;background-color:#0b675b;color:#ffffff !important;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;font-weight:bold;text-align:center;text-decoration:none !important;box-shadow:none;"><span style="color:#ffffff !important;text-decoration:none !important;background-color:#0b675b;">{{ $actionLabel }}</span></a>
</td></tr></table>
@endif
<p style="margin:0;font-size:15px;line-height:24px;color:#4a1f0c;">{{ $team === 'Mama Put Rush' ? 'See you at the buka,' : 'See you in the game,' }}<br><strong>The {{ $team }} team</strong></p>
</td></tr>
<tr><td style="padding:20px 12px;font-size:12px;line-height:20px;color:#74533f;text-align:center;">
@if($preferencesUrl)
You received this because you play Mama Put Rush.<br>
<a href="{{ $preferencesUrl }}" style="color:#74533f;text-decoration:underline;">Stop game reminder emails</a>
@else
An update for your {{ $team }} account.
@endif
</td></tr></table>
</td></tr></table>
</body></html>
