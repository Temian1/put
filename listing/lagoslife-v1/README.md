# Mama Put Rush 3D - Lagos Life listing pictures

Upload **icon-512.png** as the icon, then these five screenshots in order:

| File | Shows | Dimensions |
| --- | --- | --- |
| [icon-512.png](icon-512.png) | New game icon | 512 x 512 |
| [01-mama-put-home.jpg](01-mama-put-home.jpg) | Mama Put branding and the roadside kitchen | 720 x 1280 |
| [02-serve-nigerian-favourites.jpg](02-serve-nigerian-favourites.jpg) | Serving Nigerian food with your crew | 720 x 1280 |
| [03-owambe-catering.jpg](03-owambe-catering.jpg) | Owambe restaurant and catering order | 720 x 1280 |
| [04-build-your-crew.jpg](04-build-your-crew.jpg) | Restaurant staff and hiring | 720 x 1280 |
| [05-grow-your-food-empire.jpg](05-grow-your-food-empire.jpg) | Restaurant expansion and management | 720 x 1280 |

All six upload images are PNG or JPEG, each below 2 MB. The exact total,
dimensions and hashes are recorded in [manifest.json](manifest.json).
Other games' existing pictures also count toward the platform's shared 40 MB quota.

The icon was generated with the built-in image tool. Its 1024px master and
exact prompt are preserved in [art/listing](../../art/listing/).
The five screenshots are genuine browser captures of the game with prepared
local showcase progress, rather than generated gameplay mockups. They were
visually inspected; the capture run recorded no browser page errors.

The supplied listing rules say draft pictures expire after 30 days without
a listing change. Upload the six images through the picture slots; the JSON,
README and master are supporting files, not listing pictures.

## Lagos Life automatic sign-in

The current implementation automatically connects the Lagos Life SDK when
opened inside a recognised Lagos Life frame (or when explicitly hinted by
the launch URL). It obtains a session and sends it to the Mama Put backend,
which verifies the session and creates, links or reuses the player's Mama Put
profile. A logged-in Lagos Life player does not need a separate Mama Put
email/password registration.

This requires a valid signed-in Lagos Life session, enabled integration and
a reachable, correctly configured backend. An ordinary external link does
not automatically carry the user's Lagos Life identity. This asset task
reviewed the implementation; it did not perform a live account-registration test.
