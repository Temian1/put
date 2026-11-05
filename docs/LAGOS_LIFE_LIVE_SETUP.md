# Lagos Life live configuration

Mama Put uses its own encrypted `VatarSetting` record (ID 2) on the Laravel
backend at `war.kikter.com`. Configure credentials in **Mama Put → Settings →
Lagos Life game keys**, with separate Mama Put keys enabled and mode **Live**.
The API secret, webhook signing secret and multiplayer result signing secret
must all belong to the live game. The admin form accepts all three, validates
their mode, and clears credential inputs after saving.

Authentication is required for the restaurant campaign and both side games.
The guest registration endpoint is disabled, guest tokens cannot access saves
or submit results, and guest profiles do not appear in rankings. In Lagos Life,
every launch verifies the platform session and creates or reuses the linked
profile and a main Users account automatically. Its name follows the verified
display name. Each stored Lagos Life identity is linked to its main account
through `vatar_players.user_id`, so repeat sign-ins reuse the same account.

The official [Security and data documentation](https://lagoslife.app/developers/docs#security-and-data)
states that actual usernames and email addresses are not shared with games.
The session verification response contains `playerId`, `name`, `gameId`, `exp`
and `mode`. Email-less Users accounts therefore keep `email = NULL`; no fake
address is created and no extra personal-data form is shown inside Lagos Life.
The main account appears in Accounts (all games), with email marked as not
shared by Lagos Life. Existing linked email accounts keep their addresses.

Deploy the nullable-email migration before the account-registration code, then
run `php artisan mamaput:register-platform-accounts` to register existing
players. This command can be repeated and preserves game saves and wallets.

Credentials are server configuration. Do not commit them, put them in Vite
environment variables, or include them in browser JavaScript. Existing product
mapping remains unchanged when rotating credentials.

Webhook URL to configure in Lagos Life:
`https://war.kikter.com/api/mamaput/lagoslife/webhook`.

The multiplayer result client uses the signing key from the selected game
configuration. Mama Put's restaurant campaign does not require a multiplayer
match to authenticate a player or verify a purchase.

## Verification

From the deployed Laravel root, run:

```sh
php tests/mamaput-live-keys.php
```

The script prints pass/fail checks without credentials or player data. It checks
encrypted live configuration, API authentication using a deliberately invalid
session and invalid-key control, valid/invalid webhook signatures, rejection of
sandbox events in live mode, and selected-game multiplayer signature generation.
Webhook probes use an ignored event type. The signing check uses an unsaved
match and a mocked platform response, so it does not settle an actual match.

A real Lagos Life launch session and a real paid purchase are still needed to
exercise their full successful flows; this script does not create either.
