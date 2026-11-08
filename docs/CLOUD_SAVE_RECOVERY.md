# Shared cash and progress

Email and Lagos Life sign-in use the same linked Mama Put player. On first
sync, a browser adopts cloud cash and preserves the highest completed stars,
best scores and unlocked level. Its original local snapshot is retained under
`mamaPutRush3D.online.recovery.<playerId>` before changing recovery revisions or
adopting an unfamiliar account balance.

After an acknowledged sync, the browser stores its cash baseline. A later sync
applies the difference between current local cash and that baseline to the
latest cloud balance. This carries earnings and spending across two browsers
without adding their entire shared starting balances together. A version
conflict retries from the same baseline, so the delta is not counted twice.

Server repairs and admin edits increase `saveEpoch`. Clients adopt a higher
revision even when their local clock is newer. The API rejects uploads with an
older or unknown revision, and uses an atomic version comparison when saving.
Legacy open tabs may require a reload after a repair before syncing again.

The server preserves the highest stars, best scores and unlocked level within
one revision. Explicit admin resets create a new revision. The map refreshes
after progress-only syncs, even if cash and level are unchanged.

Account linking clears the old standalone Lagos Life coin wallet before
crediting the shared coin wallet, preventing repeat transfers on later logins.

For a manual recovery, keep a private backup, record the approved cash inputs
in `saveRepair`, merge verified progress, increase `saveEpoch` and the server
save version, and verify that a stale upload is rejected before asking the
player to reopen both browsers. Never infer current spendable cash by adding
lifetime sales or old shift profits without accounting for purchases.
