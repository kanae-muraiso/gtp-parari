# CPP LIVE event progression and shared PARARI LIVE foundation

Updated: 2026-10-13 JST. Investigation baseline: main `9461dd422326e22f2cba03742b861e300920c879`.

## Decisions agreed in this thread

- The MC controls opening STAGE → LOUNGE → closing STAGE. All attendees, including people writing a private review, see opening/closing STAGE. Their microphones/cameras must never be enabled without their own action.
- Standard CPP LIVE supports repeated ten-minute private conversations. CPP First Night supports a greeting, six company presentations (12 minutes presentation + 3 minutes Q&A each), an explanation of the networking session (approximately two hours including changeovers/buffer), two hours of networking, and approximately five minutes of closing.
- Event progression and the ordered STAGE program are separate. An item's planned duration is a timer/guide, not an automatic speaker cut-off. Late arrivals and reconnects recover current server state, never restart the event.
- STAGE will use Daily, including face-visible Q&A. MC, presenter, questioner and viewer are distinct capabilities; being given a microphone must not confer MC or billing authority. Text questions/audio-only participation remain possible.
- The MC losing connectivity does not advance the event. An authorized administrator can explicitly take over, with an audit record.
- Private calls, nametags, history, private stars/memos and normal CPP permissions must be preserved. Unsaved review drafts must survive compulsory STAGE transitions; saving failures must not block the transition or discard the draft.
- Before closing, stop new invitations AND acceptance of pending invitations. Normal full-length ten-minute talks must finish by the planned closing time. Waiting in the lounge must not create a Daily media connection. Avoid concurrent STAGE/private media connections.
- Support future company-hosted and general PARARI events. The organizing account, paying account, MC and individual presenters are separate identities. Company ownership survives a change of MC/contact person.
- Record usage for later billing, with a PARARI selling price that includes profit. Do not charge companies for CPP-hosted events merely because their employees present.

## Pricing research (not a tariff approval)

Observed 2026-10-13; exchange rate used for illustration only: USD 1 = JPY 150.

- Daily video: USD 0.004 / participant-minute in the initial paid tier; monthly first 10,000 participant-minutes free. Video sent once, including screen share, makes the session video-rated. https://www.daily.co/pricing/video-sdk/
- 100 total connections × 120 minutes: USD 48 (JPY 7,200), before free usage. 100 × 245 minutes: USD 98 (JPY 14,700); USD 58 if all 10,000 free minutes remain. Actual private-call utilization may be lower. Excludes recording and other fees.
- Remo: Starter from USD 299/month with quarterly/annual subscription, starting at 200 attendees/event; one-time from USD 699, starting at 100 attendees/event. Scope differs. https://remo.co/pricing
- Candidate only: JPY 20 per participant per ten minutes, excluding tax; possible contracted discount to JPY 15. At the above assumptions, communication cost is approximately JPY 6 per participant-ten-minutes. The difference is before payment fees, other infrastructure, support, development and overhead; it is not net profit.
- Rounding, minimum charges, audio-only tariff, cancellation, currency, tax handling, payment consent and contract terms are NOT decided. No production tariff or automatic charging is authorized by this note.
- Audience-only streaming was considered and superseded by face-visible Daily Q&A. Keep progression independent of media transport for future flexibility.

## Main investigation

`CppLiveEventRoom` checks scheduled admission every 10 seconds. `CppLiveUnifiedVenue` uses five-second roster/call polling. `cpp_live_events` has schedule/audience/cancellation and development flags, but no event phase. The active event model is separate from legacy `CppLiveSpace` and its membership-based RPCs. Do not restore the old matchmaking engine to obtain its dot rendering.

Daily `/api/parari/live/cpp/audio-test` is still development-event-only. Its rooms have two-person limits and no screen share. A real two-device private-call test does not validate a 100-person STAGE or public-event release. Existing checks mainly typecheck/build; progression requires behavioral SQL/concurrency tests.

## Delivery sequence

1. **1-A, this PR:** append-only MC audit, shared organizer/payer identities, event-scoped program and durable/versioned phase state, MC handover, authoritative invitation/acceptance gates. Opt-in is restricted to unused development events. Existing events have no control row and retain current admission/call behavior. No phase UI, STAGE media, public-event activation, payment execution or production migration in this PR.
2. **1-B:** MC panel, event read/synchronization hook, waiting/opening/lounge/draining/closing/ended views, intermediate join/reconnect/focus recovery, unsaved note retention. Read authoritative state after any notification; periodic polling recovers missed notifications. Do not trust browser broadcasts to authorize transitions. Verify before enabling in any live event. Support specifying start/end times beyond the current 120-minute UI limit; keep the database's 12-hour maximum initially.
3. **2:** separate STAGE Daily rooms/tokens, receiving-only viewer rights, explicit local mic/camera activation for MC/presenters/questioners, stage handover, screen share, audio autoplay recovery, disconnect/reconnect, provider usage capture and provider-room → event → payer mapping. Start with small multi-account tests, then controlled load tests. A 100-person production claim requires actual evidence.
4. **3:** event-scoped dot venue and the current private-call RPCs/nametags. Isolate presence per event; do not expose private notes or restore legacy RPCs.
5. **4:** early/forced call termination including provider-side revocation/ejection and prevention of re-entry with already-issued credentials; cutover to STAGE without dual audio, recover drafts. This is distinct from changing a database call status.
6. **Billing:** validated/approved tariff versions and payer consent, durable usage import with idempotency, reconciliation (including late/missing provider data), month-end statement/invoice and later payment integration. Never retrospectively price old usage with a newly changed rate. No automatic invoice from unpriced records.

## 1-A contract

- Opt-in is admin-only, development-only, one-time, and rejects recently attended or pending/active-call events. Organizer/payer must be registered live accounts controlled by the administrator configuring the event. Existing CPP participant eligibility is not expanded.
- Accounts are generic PARARI entities (`cpp`, `organization`, `individual`); account members are `owner`/`organizer`. Account setup in this pilot is administrator-provisioned. An organization account ID, not an MC user ID, identifies payer continuity. These records are not verified billing contracts.
- Organizer, payer, and `billing_status=unpriced` are fixed on preparation. No price or payment instrument is set. Only the MC (or an explicit administrator handover) can progress the event.
- Phases: `waiting → opening → lounge → closing_pending → closing → ended`. Closing can be entered only after the media drain bound. Hard scheduled expiry permits marking the event ended, but never extends admission or a call. Cancellation also ends the effective phase.
- Each mutation requires the expected version. A stale tab/retry fails without advancing twice. All mutations and call creation/acceptance serialize on the same event row; event lock is taken before any call lock.
- Starting lounge fixes a planned closing time bounded by the event deadline minus the closing program's planned duration. Invitation AND acceptance stop ten minutes before that time. The MC may enter `closing_pending` earlier, which expires pending invitations. Calls already accepted keep their original deadline.
- Until provider revocation exists, the closing barrier waits until the maximum original possible token deadline (`min(started_at + 10 minutes, event.ends_at)`) even for a call ended early in the UI. This conservative initial behavior prevents claiming a shortened DB deadline revoked a Daily token.
- Participant state exposes phase/version/server time/current program/host and talk eligibility, not account billing data, private notes or other participants' conversation identities. Host-only administrative state is separate.
- Roles for current presenters are stored as program assignments only; media permissions/hand raises are implemented and tested in phase 2. Presenter assignment does not authorize event control.

## Verification and remaining gates

Run the SQL suite in an isolated PostgreSQL database (CI service), with role switching and multiple connections for real lock races. An embedded PostgreSQL run is also supported locally; it does not substitute for concurrent-connection tests. The minimal fixture models external membership/auth dependencies; existing application route checks and later authenticated Preview tests cover their integration.

Test anonymous/outsider denial, direct-table denial, payer isolation, invalid program input, cross-event IDs, all phase transitions, stale version retries, host handover/reconnect persistence, cutoff invitation acceptance, original-media-deadline barrier, concurrent invite/accept/phase transitions, unchanged unmanaged call limits and private note/history contracts.

Do not run fixture bootstrap against any populated or production database. Apply the migration to a staging database and inspect Supabase advisors before activation. Main, production schema, Daily settings and billing remain unchanged by this draft foundation.
