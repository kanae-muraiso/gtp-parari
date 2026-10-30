# Authoring panel sets and EPUB alternatives

2026-10-30 JST

`standard` shows the existing menu. `kindle` shows TEXT, IMAGE, TABLE, NOTICE, LIST, ACCORDION, BUTTON, LINKS and structural BOOK/CHAPTER/PAGE commands. Media and interactive panels are not new insertion candidates in Kindle mode. Both insertion menus and text-selection panel conversion use the same filter. Existing panels remain editable. Billing entitlement checks remain separate and unchanged; changing a set does not grant any capability.

The selected set is saved as `authoringSet: standard|kindle` in the existing leading BOOK/PAGE metadata. Older works default to standard. No DB change or content migration is required. Switching updates only that field. BOOK settings preserve it through other settings changes; inline editing of referenced PAGEs inherits the BOOK set without rewriting each PAGE's own preference. A PAGE opened independently uses its own set. The selector is shown in work Editing and reference BOOK settings, not arbitrary nested card contents.

## EPUB rules

| Panels | Export |
| --- | --- |
| TEXT, IMAGE, TABLE | Existing native output |
| NOTICE | Simple static box, title and full body |
| LIST | Semantic list |
| ACCORDION | Expanded title and full body |
| BUTTON, LINKS | Safe text hyperlinks |
| VIDEO, AUDIO, YOUTUBE, INSTAGRAM | External link; preserve caption and AUDIO transcript |
| TOC panel | Block with guidance to use BOOK TOC settings; BOOK navigation remains supported |
| All other panels including interactive forms, QA and CAROUSEL | Block export with PAGE, panel position and tag |

Missing/unsafe media and button/link URLs also block export. Styles and known gap directives are simplified. These checks apply to export in either set, after authenticated server-side reference BOOK resolution; a client cannot bypass them by hiding an editor warning. The authorized API responds 422 with issues, and the EPUB writer independently rejects a model with blocking issues. No export with silently omitted unknown panels is produced. Conversion notices are included in the existing warning header with a bounded size. Saved SSOT is never rewritten by export.

The editor shows issues for the content being edited; the server performs the complete saved BOOK check, including closed referenced PAGEs. Final device presentation still depends on the reader. Individual panel selection, custom saved sets, add-on purchases and new billing rules are deliberately deferred.

Validation: test:panel-sets tests SSOT preservation, BOOK preference persistence, actual React menu filtering and static EPUB alternatives. test:epub-export checks 422 for standalone and referenced unsupported panels, invalid links, preserved source and successful media conversion, alongside existing authorization/plan tests. Existing TABLE/rich text/viewer/legacy tests remain in CI.
