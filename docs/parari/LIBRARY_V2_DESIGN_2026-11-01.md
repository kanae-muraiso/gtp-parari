# PARARI LIBRARY v2 — design specification (2026-11-01)

Status: DESIGN ONLY. No database migration, production UI change or deployment in this branch.

## Product principles
- LIBRARY is a user's record of works, followed authors, purchases, applications and memberships.
- STUDIO remains creation/management; top-level 参加先 remains a cross-workspace navigation destination.
- A user can both publish works and follow others. No forced author/reader role.
- Public author shelf is an alternative to existing homepage modes (WEB/profile/works), not a replacement.
- A work remains a single parari_books SSOT record. No content copies into shelves.
- Purchases stay in two systems: commerce purchases/entitlements and APPLICATION payments.
- A star is a one-click favorite/save, not a 1–5 rating. Fan registration is independent of work stars and membership.

## Library navigation
- 書棚: 自分 / 作者別 / これから読む / 読んだ / お気に入り, with user-defined categories.
- 作者を探す: username/name lookup and opt-in directory. Directory opt-out does not make public author pages private; distinguish lookup from directory discovery.
- 購入: both commerce and paid APPLICATION records with source/type labels, preserving entitlements and refunds.
- 申込: dated participation records, past and future, including cancellation and payment status.
- メンバーシップ: active and past membership records; not a duplicate of top-level 参加先.
- カレンダー remains separate: user's bookings plus public occurrences of followed authors; later event search by keyword, city, date.

## Proposed data (new; do not repurpose legacy user_bookshelf)
1. parari_author_follows: follower_user_id, author_user_id, created_at; unique pair; no self-follow; counts computed from rows.
2. parari_work_stars: user_id, work_id, created_at; unique pair; one star = saved to favorites.
3. parari_reading_states: user_id, work_id, state ('to_read','reading','read'), updated_at; unique pair. Opening a work must not automatically imply 'read'.
4. parari_library_categories: id, user_id, name, sort_order, created_at; unique (user_id, name).
5. parari_library_category_items: category_id, target_kind ('author','work'), target_id, created_at; unique (category_id,target_kind,target_id); enforce category ownership server-side and validate target access.
6. profiles: add author_directory_opt_in boolean default false, introduction_work_id nullable; homepage_mode adds 'library' only after checking existing accepted values.
7. Optional later: parari_follow_notification_preferences keyed by follower/author, and notification delivery/outbox tables. Do not send email automatically upon following.

Avoid a second stored author-work mapping: published works are selected from parari_books by owner and visibility, with a separate explicit show/hide setting. Use the existing show_in_profile_works after confirming its semantics or migrate it carefully.

## Security invariants
- RLS on all new public tables, with ownership for user-private records. A user's follow/category/reading data is not publicly enumerable.
- Public author shelf returns only explicitly public, non-deleted, non-expired works that are approved for display. 'unlisted' is never listed solely because the visitor knows username.
- Purchased work content access is determined by entitlement/visibility, not presence in a shelf.
- Fan count: author sees total; public display opt-in separately if introduced.
- Directory includes only opted-in authors; search of exact username must not expose private profile fields.
- Membership and APPLICATION records visible only to participant/authorized organizer.
- No service-role query without explicit authenticated identity and per-record authorization.
- Deleting a star removes it from favorites but never revokes purchased access.

## Implementation slices and acceptance
A. Add schema migrations and RLS, with tests for cross-user isolation, unlisted leaks, unique pairs and category ownership.
B. Add authenticated follow/star/reading/category endpoints; public author shelf and directory endpoints; test guest vs owner visibility.
C. Rebuild /my/bookshelf UI with unified tabs and category organization. Preserve legacy URLs via redirects/adapters; migrate legacy saved/read_later/viewed records with idempotent backfill after auditing values. Do not destroy original rows until verified.
D. Integrate public author shelf, optional intro PAGE, follow button and stars in viewer. Existing WEB homepage mode must still work.
E. Consolidate purchase and application record presentation without merging underlying ledgers; membership record view preserves inactive entries.
F. Calendar: merge bookings and followed authors' public occurrences, deduplicate by occurrence ID, honor timezone/cancellation; no global search in first release.
G. New-work in-app notifications and Organizer-only fan messaging later, with unsubscribe, rate limits and consent.

## Code entrypoints inspected
- src/app/my/bookshelf/page.tsx and src/components/parari/BookShelfPanel.tsx
- src/app/api/my-shelf/route.ts
- src/app/my/purchases/page.tsx
- src/app/api/my-memberships/route.ts
- src/app/api/my-participations/route.ts
- src/app/my/calendar/page.tsx and src/app/api/calendar/my/route.ts
- src/app/[username]/page.tsx and src/app/[username]/works/page.tsx
- src/components/parari/navigation/MyPrimaryTabs.tsx

## Pre-migration audit
- Confirm all legacy user_bookshelf.type values, duplicates and nulls.
- Inspect RLS policies, foreign keys, publication logic and URL routing before migration.
- Confirm application payment vs commerce purchase accounting and cancellation statuses.
- Confirm current reader progress mechanism and do not mistake an open event for completion.
- Write migration/backfill rollback plan and tests before deployment.
