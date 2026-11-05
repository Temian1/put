<!doctype html>
<html>
<body style="margin:0;padding:24px 12px;background:#fdf1dc;font-family:Arial,Helvetica,sans-serif;color:#4a1f0c">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:24px">
        <h1 style="margin:0 0 16px;font-size:20px">{{ $title }}</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.5">Hi {{ $playerName }},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5">{!! nl2br(e($body)) !!}</p>
        <p style="margin:0;font-size:15px;line-height:1.5">The {{ $team }} team</p>
    </div>
</body>
</html>
