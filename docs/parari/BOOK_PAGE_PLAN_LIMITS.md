# BOOK / PAGE plan limits

2026-10-31 JST. Implemented in PR; production requires the accompanying migration and application release.

| Plan | BOOKs | PAGEs per BOOK | Characters per PAGE | Image quota |
| --- | ---: | ---: | ---: | ---: |
| Free | 3 | 20 | 20,000 | 100 MiB |
| Plus | 100 | 100 | 50,000 | 1 GiB |

Organizer/Host retain their existing 100-PAGE capacity and receive the same 100-BOOK/50,000-character authoring limits as Plus. Pro/monitor retain unlimited authoring. Prices, EPUB eligibility, image quotas and commerce fees are unchanged.

## Counting

- BOOKs have their own quota, irrespective of visibility; both reference and legacy embedded BOOKs count.
- Existing standalone PAGE/WEB allowance stays at Free 10 / Plus 100. Active owner BOOK references exclude their contained PAGEs from this allowance and from duplicate published-work counting. WEBs are not exempted by a PAGE reference.
- PAGEs per BOOK count references (including repeat appearances) or parsed PAGE/PAGEINFO headers in embedded content, excluding chapter dividers. These are logical PAGEs, never viewer pagination sheets.
- Text counts Unicode code points of authored TEXT and non-media panel bodies, excluding whitespace, zero-width placeholder characters, structural lines and media/structure metadata. Inline decoration notation is included; images/URLs in media metadata do not consume text allowance. Existing parseBlocks handles protected TABLE containers.
- An interrupted structural operation may leave an independent derived PAGE. To prevent repeated internal PAGE creation from accumulating without bound, the total stored PAGE pool is capped at `bookLimit * pageLimitPerWork + workLimit` (70 Free / 10,100 Plus). The API validates an owned parent BOOK or source PAGE before granting structural-creation allowance. This allowance never grants billing entitlements.

## Preserve manuscripts

- New works enforce limits before insertion. Save rejects only increases beyond PAGE/text limits, permitting existing oversized works to shrink or be split. No content is truncated or deleted.
- BOOK editor checks PAGE capacity before creating split/append results. PAGE→BOOK checks BOOK capacity before creating copies. Server guards still validate every write.
- Editing routes offer an exact SSOT text download of rejected drafts and attempt localStorage recovery under a work-specific key. A storage failure never prevents downloading the in-memory draft. Backups do not silently overwrite a newer saved work; authors can download/delete them explicitly.
- Existing saved oversized works remain readable and EPUB-exportable under the existing export plan entitlement. New public publication checks referenced owner PAGE contents too; making a work private remains available.
- Detached PAGEs can make the independent-work count exceed the allowance. Detachment and existing data are preserved; subsequent creation is blocked until usage is reduced.

## Database rollout

`20261031021534_book_page_plan_limits.sql` replaces the existing plan trigger function and PAGE counter; it does not rewrite work rows, add columns or alter RLS. It serializes owner quota checks, including service API BOOK/PAGE-pool creation. Legacy direct-client saves retain independent-work and text guards. The authenticated API uses parseBlocks-based text counting; the direct-client SQL guard conservatively normalizes text lines for legacy writers.

Apply once immediately before the production application release. Do not apply this production migration merely to review a Vercel preview. Rollback must account for the new 20-PAGE Free allowance; restoring the old 10-PAGE trigger would restrict new structural edits, although saved works remain intact.

## Verification

`npm run test:book-page-limits` runs actual authenticated create/update/publication/usage handlers against a deterministic database adapter, checks foreign/missing context and failure isolation, Unicode and exact draft downloads, and executes the exact migration on an isolated PGlite PostgreSQL engine. No production content is written in tests. `test:epub-export` retains its existing 205-PAGE archive compatibility case.
