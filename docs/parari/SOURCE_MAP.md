# Active PARARI source paths

Reviewed against main `fdae2874915264217a8157f04d8f0180f0e69405` on 2026-10-07 JST and the cleanup changes in this commit. Git history is the recovery source for retired implementations.

## Work creation, editing and reading

| Purpose | Active entry and implementation |
| --- | --- |
| Creation | `/editor/new`, `/editor/quick` |
| Editing | `/editor-v2/[id]` → `mvp/PagePanelComposer` or `mvp/WebPageComposer` |
| Public work reader | `/p/[id]`, `/access/[key]`, `/[username]/[workSlug]`, `/[username]/[workSlug]/[pageSlug]` → `PublicViewerShell` |
| Old PAGE creation/edit URLs | `/[username]/pages/new` redirects to `/editor/new`; `/[username]/pages/[workId]/edit` redirects to `/editor-v2/[id]` |
| Old PAGE reading URL | `/[username]/pages/[workId]/view` preserves its profile/owner/visibility checks, then uses `PublicViewerShell` |
| Reader format dispatch | `PublicViewerShell` → `viewer-v2/ParariViewer` for every work; `buildViewerDocument` derives its reading sheets from existing SSOT |
| Shared reading content | `reader/ReaderBodyPanelRenderer` and `viewer-v2/ViewerTextBlock`; `ReaderToolbar` owns the shared menu and `readerProgress` handles per-work reading position |
| Editor/CPP content rendering | `mvp/PageBodyPanelRenderer` is used by editor previews and CPP profiles; it is still active |

`ParariViewer` is the only reading controller. BOOK keeps cover/chapter/TOC composition through `book/buildBookSheets`; PAGE content stays intact as a reading sheet; WEB selects its page through `web/webSsot` and adds site chrome through `web/WebPageFrame`. Display mode, font, dictionary, ruby and reading-position reset all use one menu. Complex panels remain intact when they cannot be split safely. The three former viewers and `ReaderSettingsBar` are retired; do not restore alternate reading controllers. Existing BOOK progress is read as a compatibility fallback and new progress is keyed by work ID (and WEB page slug).

Despite its directory name, the retained `mvp` code is used in production. Do not delete a component based on its name. Old standalone `PageEditor`, `PagePublicView`, development routes, unused components and old patchers have been removed. Do not restore them as alternate active paths.

## Dictionary and data

The runtime English dictionary is the database table `parari_english_dictionary`, accessed through `/api/english/dictionary`. Administration uses `/my/operations/dictionary` and `/api/internal/english-dictionary`.

Editor tools are one optional **英語教材支援** menu. Enable it under `/my/settings#english-authoring`; the account preference `english_authoring_enabled` in Auth user metadata defaults to OFF. This preference never grants an entitlement. `/api/english/authoring` verifies the authenticated editor's current `getUserPlanAccess` (Plus/Organizer/Host/Pro, retaining the existing monitor override) and opt-in before querying. Billing/profile errors fail closed. Public reader dictionary access remains independent.

`EnglishAuthoringProvider` scopes all editor dictionary menus and support previews, including nested panels. `RichTextField` uses real lookup results and display-only CSS highlights. The old always-unregistered stub and separate “読む支援” menu are retired. TEXT reading-support attributes keep their existing serialization and are never cleared by opt-out or downgrade. Their current scope is editor confirmation; the public unified viewer still uses reader menu choices. Long-text fallback exposes the same confirmation options without offering Lexical-only selection tools.

`test:english-authoring` checks real route handlers, shared plan rules, React settings, Lexical selection, lookup failure/cancellation, highlights, opt-out/downgrade and preservation of saved TEXT content/attributes against simulated Auth/database responses and DOM geometry. It does not claim signed-in production or visual browser verification.

The old CSV master was already removed in PR #94. Its remaining comparison/batch scripts and 22 derived CSV reports were retired in this cleanup. The three original input lists (`center_exam_words.csv`, `中学英単語.csv`, `高校英単語.csv`) remain as source material for future dictionary coverage work. They are not runtime masters; database coverage of every source word has not been assumed. Database migrations and database contents are unchanged.

## Verification and recovery

All Next.js route conventions and proxy files were treated as roots, even without inbound links. Literal imports, re-exports, `require`, dynamic imports, type imports and test-script references were checked; no computed module paths were found. After deleting the retired routes and their exclusive dependencies, no unreachable source modules remained. Public URLs were reviewed separately: old user-facing PAGE URLs remain compatible, while seven development/sample routes were retired.

Run repository hygiene, typecheck, build and `test:legacy-page-routes` / `test:unified-viewer` after entrypoint cleanup. The regression test checks real route modules with a read-only database adapter, including public/unlisted access, owner access, private rejection, username/work ownership mismatch and database errors. The unified-reader tests render real components and exercise React DOM interactions, with synthetic geometry and dictionary responses. They cover mode/font/ruby/dictionary changes, pagination content preservation, resize, progress restoration and reset. They do not replace browser layout or signed-in tests.

Use Git history for recovery. Do not add timestamped backups, deprecated copies, generated dictionary snapshots or Supabase local CLI state to the source tree.
