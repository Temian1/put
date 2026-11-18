# Player emails

The shared HTML email uses presentation tables, inline CSS, system fonts,
explicit white CTA text and no CTA underline. Plain text is included. This
follows Gmail's supported CSS approach; inbox dark-mode and search highlighting
remain controlled by the recipient's mail app.

After a cloud-save leaderboard increase, eligible overtaken players are placed
in `mamaput_player_emails`. Valid linked account email is preferred, with typed
contact email as fallback. The email is not limited to the top-50 in-game
notification window. A recipient gets at most one email per board per Lagos
calendar day. Names and body text are escaped by the template.

`php artisan mamaput:player-emails --dry-run` counts new comeback reminders.
Without `--dry-run`, it discovers profiles inactive for at least 48 hours and
delivers pending emails. Each absence sends once; a new visit starts a new
absence period. Duplicate addresses are grouped, and an address with an active
profile does not receive a comeback reminder. Delivery rechecks activity,
address, bans and opt-out status. Failures retry after 15 minutes, at most three
attempts. Permanent SMTP recipient rejections (550/551/553) are marked
`rejected` instead of being retried. A claimed `sending` row is not automatically resent after a crash,
since transport acceptance may be ambiguous.

Signed GET preferences links show a confirmation page. Signed POST links stop
future automated game emails and support List-Unsubscribe headers. Visiting
the GET link alone does not change preferences.

The console schedule fragment runs the command every minute with overlap
protection. Production also has a dedicated per-minute cron entry because the
previous scheduler cron belonged to another application. Existing cron entries
were preserved. SQL row claims and unique dedupe keys protect overlapping runs.
Lagos Life players are directed to Lagos Life; account-only players are directed
to the game's public URL. No game-save balances are changed by this feature.

Production deployment backs up the SQLite database, current source and crontab
privately, runs only the email migration, and patches controller/routes without
replacing unrelated work. A transport-accepted send is recorded as `sent`; this
does not prove final inbox delivery or inbox placement.
