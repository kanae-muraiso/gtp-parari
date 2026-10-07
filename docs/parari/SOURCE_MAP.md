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
| Reader format dispatch | `PublicViewerShell` selects `viewer-v2/ParariBookViewer`, `ParariWebViewer` or `ParariPanelViewer` according to the SSOT format |
| Shared reading content | `reader/ReaderBodyPanelRenderer` and `viewer-v2/ViewerTextBlock`; WEB delegates its page body to `ParariPanelViewer` |
| Editor/CPP content rendering | `mvp/PageBodyPanelRenderer` is used by editor previews and CPP profiles; it is still active |

BOOK has pagination, cover and navigation behavior; WEB has site navigation; Panel renders PAGE content. These are active format adapters, not backup viewers. BOOK's reading menu and the Panel/WEB `ReaderSettingsBar` currently differ. This cleanup does not claim menu feature parity or change their settings.

Despite its directory name, the retained `mvp` code is used in production. Do not delete a component based on its name. Old standalone `PageEditor`, `PagePublicView`, development routes, unused components and old patchers have been removed. Do not restore them as alternate active paths.

## Dictionary and data

The runtime English dictionary is the database table `parari_english_dictionary`, accessed through `/api/english/dictionary`. Administration uses `/my/operations/dictionary` and `/api/internal/english-dictionary`.

The old CSV master was already removed in PR #94. Its remaining comparison/batch scripts and 22 derived CSV reports were retired in this cleanup. The three original input lists (`center_exam_words.csv`, `中学英単語.csv`, `高校英単語.csv`) remain as source material for future dictionary coverage work. They are not runtime masters; database coverage of every source word has not been assumed. Database migrations and database contents are unchanged.

## Verification and recovery

All Next.js route conventions and proxy files were treated as roots, even without inbound links. Literal imports, re-exports, `require`, dynamic imports, type imports and test-script references were checked; no computed module paths were found. After deleting the retired routes and their exclusive dependencies, no unreachable source modules remained. Public URLs were reviewed separately: old user-facing PAGE URLs remain compatible, while seven development/sample routes were retired.

Run repository hygiene, typecheck, build and `test:legacy-page-routes` after entrypoint cleanup. The regression test checks real route modules with a read-only database adapter, including public/unlisted access, owner access, private rejection, username/work ownership mismatch and database errors. It does not replace a signed-in browser test.

Use Git history for recovery. Do not add timestamped backups, deprecated copies, generated dictionary snapshots or Supabase local CLI state to the source tree.
