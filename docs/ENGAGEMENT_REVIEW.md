# Keeping the owner involved after hiring staff

Review date: 2026-10-28. Recommendations below are proposed design changes, not implemented features.

## Current findings

- The live Vercel game at https://mamaput-phi.vercel.app/ was checked through its level map with isolated local progress and blocked account/API calls. Levels 1, 2, 10, 30 and 62 showed targets of 15, 20, 60, 160 and 320 customers. Growth already applies throughout the campaign.
- Sink capacity was fixed at 4 plus equipment upgrades; online orders had the same quantity and two-order limit throughout the campaign. The accompanying change scales these with the shift's customer target, with equipment bonuses retained.
- Managers automatically covering cooking and serving is specific to Watch mode. Normal shifts use the hired crew. An effective crew can still complete routine work without giving the player many decisions.
- Increasing an automated shift's length increases waiting, not necessarily engagement. A level-62 shift already allows about 33 minutes. Keep the requested total customer goal, but divide the experience into meaningful service periods.

## Recommended first release: service waves, owner specials and crew priorities

| Mechanic | Specific Mama Put version | Why it helps |
| --- | --- | --- |
| Service waves | Split the existing target into waves of about 25 customers, with a short planning break and saved progress between waves. Keep all 320 customers in the level-62 goal. | Creates near-term finishes and comfortable stopping points within a long level. |
| Owner specials | Offer occasional optional plates with a simple player-controlled finishing action. Staff handle cooking and ordinary service; the owner earns a quality/tip bonus. Skipping a special forfeits the bonus rather than blocking normal service. | Gives active play an advantage while preserving the value of hired help. |
| Crew priorities | Choose counter-first, delivery-first or restock-first, with visible workloads and reasons when someone is waiting. | The owner makes tactical decisions rather than repeating every worker's taps. |
| Contract choice | Offer three contracts with different menus, portion counts, deadlines and rewards. Accept only what the current kitchen can handle. | Adds planning and risk selection instead of imposing another random mandatory task. |
| Announced service disruptions | Occasional short events with clear choices: a gas refill, traffic delaying a rider, or a supplier substitution. Provide warning, viable alternatives and a limited frequency. | Changes the problem the player solves without relying only on faster customers. |
| Rotating mastery challenges | Optional weekly recipe or restaurant challenges with cosmetic rewards and a personal best. Existing daily missions remain. | Gives skilled, fully upgraded players fresh goals beyond accumulating money. |

Avoid making paid-for workers deliberately ineffective or requiring a confirmation tap for every automated action. Let staff remove repetitive work; give the owner decisions with visible consequences. Pilot the first three mechanics before adding all six.

## Research and limits

- [Team17's Overcooked! 2 FAQ](https://www.team17.com/news/overcooked-2-faq) describes kitchens that change during a level, plus practice mode and an extra-star challenge. The lesson for Mama Put is changing conditions and optional mastery, rather than copying its multiplayer controls.
- [Nordcurrent's Cooking Fever challenge and tournament guide](https://nordcurrent.zendesk.com/hc/en-us/articles/21965286110226-In-game-Tournaments-and-Challenges) describes recurring competitive and harder challenge modes. The lesson is fresh goals for experienced players; its entry fees and failure penalties are not necessary for this design.
- [Supercell's Hay Day Derby tasks](https://support.supercell.com/hay-day/en/articles/derby-tasks-2.html) lets players choose tasks. That supports a contract board with player-selected commitments rather than compulsory busywork.

These are design inferences from the mechanics, not evidence that they will improve Mama Put's retention. Test with players and compare active decisions per minute, wave completion, repeat sessions, failure reasons and optional-special participation. Existing financial shift reports alone do not measure those outcomes.

## Verification of the accompanying workload fixes

All 125 unit tests, lint and the production build passed. Two focused browser checks confirmed customer targets and sink counts through level 100, retained counts during washing, and the later delivery quantities and active-order cap. The all-level unit check covers the complete 1–100 sequence. Full live-account, wallet and all-level playthrough tests were outside this change.
