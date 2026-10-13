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

1. **1-A, PR #134:** append-only MC audit, shared organizer/payer identities, event-scoped program and durable/versioned phase state, MC handover, authoritative invitation/acceptance gates. Opt-in is restricted to unused development events. Existing events have no control row and retain current admission/call behavior. No phase UI, STAGE media, public-event activation, payment execution or production migration in this PR.
2. **1-B, dependent UI PR:** MC panel, event read/synchronization hook, waiting/opening/lounge/draining/closing/ended views, intermediate join/reconnect/focus recovery, unsaved note retention. Read authoritative state after any notification; periodic polling recovers missed notifications. Do not trust browser broadcasts to authorize transitions. Verify before enabling in any live event. Support specifying start/end times beyond the current 120-minute UI limit; keep the database's 12-hour maximum initially.
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


## 1-B implementation and verification

- New UI work is based on `feat/cpp-live-event-progression` (`812f56b`), which is still an unmerged draft. Merge/review 1-A before retargeting the dependent UI PR to main. No production migration or deployment is performed by this change.
- `CppLiveEventRoom` is the active route boundary. It reads admission and progression together every five seconds, and on focus, visible-tab recovery and network recovery. Only a confirmed missing progression RPC supports pre-migration compatibility; network/authorization/malformed/stale state never turns a known managed event into an unmanaged lounge.
- The server timestamp anchors the local display timer. MC commands carry the expected version and require explicit confirmation. The server remains authoritative for closing, talk admission and media drain. UI elapsed timers never advance the event.
- Waiting/opening/closing/ended views take priority over PRIVATE TALK and review. Entering STAGE unmounts the private media surface; the new STAGE view itself constructs no media connection or microphone/camera request. It clearly states that STAGE broadcasting is not yet implemented.
- Drafts are scoped to user + event + call, with a versioned `sessionStorage` format and memory fallback. STAGE transitions attempt a save once without delaying the transition. Failed saves remain editable/retryable beneath STAGE, including after scheduled expiry. A save response cannot erase newer typing. Drafts are cleared on observed logout/account switch and are not a replacement for permanent server notes; close the tab only after saving. Blocked browser storage is reported in the UI.
- Note saves bind the request to the draft owner's authenticated token, rather than relying on an asynchronously changing global session. The fixture tests this boundary; no token is logged or persisted by draft storage.
- Scheduling accepts explicit start/end dates and times in JST, including midnight crossings, while preserving the database's twelve-hour maximum.
- The separate controlled rehearsal creator offers a standard CPP LIVE preset and a First Night preset (six 12+3 minute company sessions, 120-minute opening including instructions/buffer, 120-minute lounge, five-minute closing). Titles and planned durations are editable before creation.
- `cpp_live_create_controlled_test_event` atomically creates a development-only event, attaches the creator's CPP organizing/paying account, leaves billing unpriced, and sets the creator as MC. Validation failure rolls everything back. `cpp_live_event_host_candidates` lists only members of the event's organizing account to its MC/admin; it does not expose paying-account members or grant membership.
- Browser UI tests use actual React DOM components with synthetic RPC/auth and Daily responses; they do not establish real Daily connectivity or a 100-participant capacity claim. The SQL suite uses repository migrations with minimal external membership fixtures, and PostgreSQL CI covers real connection races.

### 検証環境での操作確認（実機確認は後日）

1. 隔離した検証DBへ①-A、①-Bの順でmigrationを適用し、Supabase advisorsと権限を確認する。本番DBへテストfixtureを実行しない。
2. 管理者モードの「CPP LIVE開催管理」から「STAGE・LOUNGEの進行確認」を開き、プログラムを確認して会場を作る。開発用URLはCPP登録者だけに共有する。
3. 司会者と参加者で別アカウントを使い、開会待ち→オープニング→自由交流→受付停止→クロージング→終了を確認する。次の項目・二重クリック・古いタブの操作も確認する。
4. PRIVATE TALK中は終了時刻まで維持されること、振り返り中でもSTAGEへ切り替わること、保存失敗後もメモを再保存できることを確認する。
5. 再読み込み、通信断・復帰、途中入室、管理者の司会引き継ぎ、アカウント切替、12時間の開催上限を確認する。
6. STAGEの映像・音声・画面共有は②で実装・実機検証する。この画面だけで講演配信の準備完了とはしない。

## 2-A STAGE pilot implementation

Implementation continues from #135 on `feat/cpp-live-stage-media`. See [the STAGE test runbook](CPP_LIVE_STAGE_TEST.md) for environment gates and actual device steps.

- Development-only, separate `cpp-stage-<room UUID>` rooms. Daily Prebuilt uses the same direct iframe pattern as the device-tested private call, and is loaded only on an explicit connect action. All join paths set audio/video OFF; prejoin device activation is disabled. Viewers have `canSend:false`; questioners can send audio/video; host/presenters additionally share their screen. No browser receives Daily owner/admin authority.
- Application host controls remain server-authenticated/versioned. Provider identity UUIDs are mapped to users but never confer event or payer authority. Role changes retire the previous identity via Daily `eject` with `ban:true`, then permit a fresh identity; users explicitly reconnect and enable their own devices.
- The event row serializes ticket issuance with retirement. Phase/host changes are blocked while any unexpired identity lacks a service-only retirement acknowledgment. Provider failure leaves a retryable state and cannot unlock LOUNGE. Host handover closes the old generation; a monotonic epoch permits a later return to the original host without resurrecting an old room.
- Admission tokens last at most 60 seconds; ongoing connection expiry inherits the room deadline (no token ejection override). Opening/closing and handovers use distinct rooms. Late API responses are re-authorized before returning a token; UI generation guards and iframe removal prevent media resurrection after unmount.
- Rooms snapshot organizer/payer mappings. Tickets are permission records only. Signed participant webhooks persist actual provider join/duration facts separately, deduplicate event IDs and session/type, and tolerate out-of-order delivery. No invoice/price is assigned. Reconciliation of missing deliveries and rate classification remain a billing gate.
- Small-account physical tests, actual ban/re-entry behavior, expiry inheritance, two-hour continuity and load verification are required before public activation. The opt-in flag defaults OFF. No production migration or main merge is performed in this draft.
