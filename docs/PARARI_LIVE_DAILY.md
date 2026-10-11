# PARARI LIVE / Daily integration (draft, 2026-10-11)

## Status
The server-only transport adapter exists at `src/lib/parari/live/dailyServer.ts`.
**There is an isolated, unlinked audio pilot route and CPP-authorized token endpoint. No production-ready integrated LIVE UI, video switching, billing or verified two-account call yet.**
Do not merge or enable production media access at this stage.

## Boundary
- PARARI/Supabase decides the conversation ID, entitled participants, media policy and fixed expiry.
- Daily creates short-lived private transport rooms and tokens.
- CPP retains its existing matching, chat, queues, and original 10-minute clock.
- Organizer/HOST access and metering are a later layer, not conditions inside the Daily adapter.

## Security requirements before exposing any endpoint
1. Authenticate each request with the current Supabase user, not a user ID supplied by the browser.
2. Verify the user is one of the two members of an ACTIVE CPP matching_live_direct context.
3. Verify the user is currently allowed in CPP and not suspended; verify context session_started_at and session_expires_at.
4. Use the original server-controlled `session_expires_at` for every Daily room/token, including after reconnect or switching.
5. Do not mint additional connections after the deadline; expire/eject both endpoints as the deadline arrives.
6. Persist a single Daily transport per conversation and media generation to avoid duplicate rooms, racing join requests, or unmetered loops.
7. Reject any request for arbitrary room name, room expiry, or other user's token.
8. Disable recording and screenshare; never send Daily API key to browser.
9. Cap issuance and concurrency; return generic errors without leaking Daily server responses.
10. Add automated tests for unauthorized participant, inactive conversation, expiration, expired reconnect, switching, and concurrent race.
11. Keep video/audio **provider billing** separate from participant camera visibility. Test Daily billing behavior on provider records; stopping a camera within a video session does not necessarily lower provider billing.

## Implementation stages
- A: read existing CPP live components and RPCs; determine stable, authoritative conversation state.
- B: database transport mapping/authorization and 10-minute invariants; security tests.
- C: authenticated API: create-or-fetch media room and mint user-specific tokens; rate limit, expiry, idempotency.
- D: minimal audio-first call object UI with social profile photo and microphone/camera permissions.
- E: video transition and downgrade to NEW audio-only room without resetting conversation expiry; explicit notification during reconnect.
- F: actual two-account test on desktop/mobile, reconnect, ten-minute expiry, and Preview CI.
- G: separately implement HOST usage ledgers + billing only after CPP is stable.

## Environment
`DAILY_API_KEY` is a Vercel Preview secret. Do not add `NEXT_PUBLIC_` prefix. New Preview deployment required when code changes.

## References
- https://docs.daily.co/reference/rest-api/rooms/create-room
- https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token
- https://docs.daily.co/reference/daily-js/daily-call-client

## Audio pilot (draft)
- Browser route: `/my/cpp/live/audio-pilot?threadId=<active_CPP_thread_uuid>`.
- The URL is intentionally not linked from CPP LIVE. A valid, currently active CPP conversation and login are required to enter.
- The pilot uses Daily Prebuilt iframe as a disposable integration test surface, **not** the final PARARI custom audio/video/photo UI.
- The user must explicitly press Start. The server verifies CPP membership and conversation before issuing a room-bound token.
- A server-controlled ten-minute deadline is enforced by Daily ejection and the pilot removes the iframe locally at expiration.
- Existing CPP matching, text chat, queues and navigation remain unchanged.
- Requires Preview deployment with `DAILY_API_KEY`. Do not add Production env secret or enable globally until approved.
- Test and correct the remaining build/SDK/API errors before asking users to open this route.
