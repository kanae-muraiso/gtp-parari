# CPP同窓会 LIVE — integration contract (2026-10-11)

## Decisions
- All authenticated CPP alumni participants may enter an **alumni-only** LIVE space, including participants who did not opt into the researcher program.
- Do not change `cpp_matching_context`, `cpp_live_my_membership_id`, researcher BROWSE permissions, company entitlements, or existing researcher/company LIVE availability to grant alumni access.
- Navigation link is `/cpp/alumni/live`; guard with the existing `AlumniAccess` gate.
- Build a distinct alumni LIVE attendance/conversation policy that reuses the PARARI LIVE media transport and message infrastructure, not researcher/company matching membership.
- Do not automatically enable recording, public participant lists, or indefinite billable rooms.
- When alumni leave the room, they retain normal CPP alumni message rights. LIVE should never silently grant new access to researcher profiles.

## Current stage
- Alumni nav and route scaffold: implemented, with explicit not-yet-open status.
- Activity dashboard: implemented, restricted to CPP admin mode; aggregate counts only.
- **Alumni media conversations are not yet implemented. Do not merge or tell users the alumni LIVE is open.**

## Remaining implementation before release
1. Define distinct alumni session/participant/consent records and RLS/RPC with active alumni check on every transition.
2. Add lobby, invitations, mutual acceptance and exit behavior with rate limits.
3. Connect PARARI LIVE media adapter from PR #108 with short-lived credentials, never client-supplied user IDs.
4. Carry a single fixed CPP conversation deadline across media switches/reconnections; ensure exit/expiry ejection.
5. Add secure audio-only -> video and video -> audio generation synchronization for both members.
6. Unit test both parties, non-alumni, former alumni, blocked member, anonymous, expired conversation and simultaneous invites.
7. Validate Preview with 2 accounts before the LIVE nav can host a usable room; keep original CPP LIVE intact.

## Activity dashboard privacy
- 7-day message count, distinct conversing pairs, pairs whose first message was in the last week.
- No sender, recipient, thread, message text, read status or timestamps returned to client.
- `cpp_alumni_message_activity` validates authenticated CPP admin mode **inside database**; direct anon execution revoked.
- PR migration matches live DB RPC applied on 2026-10-11. Avoid applying it twice or creating duplicate routine signatures.
