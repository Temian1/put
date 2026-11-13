# Staff purchases and live admin counts

Support ticket 3 reported repeated staff hiring fees and lost workers after
signing back in. The affected save recorded 81 hires but no current crew.

Hiring already charges once per worker; wages accrue separately for shifts.
The fix preserves edits made while a cloud request is in flight, uploads
purchases promptly, checks account sync before hiring, and blocks manual logout
when saving fails. A failed upload leaves the worker and deduction saved on the
device for retry. This does not guarantee recovery after clearing browser data
before a successful upload. Staff instructions now explain the one-time fee.

The player received a cook, server and cleaner at each of three owned
restaurants without another hiring charge. These are replacement workers;
the exact historical roster could not be reconstructed. The account was backed
up privately, and the repair is recorded once with a new save revision.

Filament counts current restaurant crews instead of the legacy staff array.
Existing staff totals were corrected without changing game saves. Player and
shift tables and the statistics widget refresh every 10 seconds. Visible game
sessions check presence every 30 seconds; "Online now" means seen within two
minutes. Today's shift statistics use the Lagos calendar day.
