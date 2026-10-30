# Simple TABLE panel

2026-10-30 JST

TABLE is a text-only grid inserted from the existing panel menu (表). It starts with two columns and three rows. The author can edit cells and an optional caption, toggle the first row as column headings, insert below/right of the focused cell, and remove that row/column. A nonempty removal asks for confirmation. At least one row and column remain. Cell merging, calculations, media, and COLLECTION view switching are outside this implementation.

The work SSOT remains the only stored source. Existing works need no migration and existing tags keep their format. A new explicitly closed panel is added:

```text
[TABLE]
caption: 比較表
header: true
|項目|内容|
|A|説明|
[/TABLE]
```

Each row starts and ends with a pipe; empty cells are retained. Backslash, pipe, newline and carriage return inside a value are escaped as `\\`, `\|`, `\n`, `\r`. Caption uses the same escaping. This prevents user cell text from becoming structural PAGE/BOOK tags. `header: false` makes all rows body rows. Short rows are padded without discarding any cell. The existing explicit-container parser protects the table boundaries. Style attributes remain in the existing header attribute system.

The shared panel registry renders a semantic table with caption and column headers. React escapes text, and the table region can scroll horizontally on small screens. EPUB uses escaped XHTML table/thead/tbody/th/td and line breaks, with simple borders and wrapping. This is a reflow table, not an image or interactive widget.

Validation: `npm run test:table-panel`, `npm run test:epub-export`, the existing unified-viewer and legacy-route regressions, and typecheck. The table test exercises real React DOM cell entry and row/column operations with jsdom, round-trip through block serialization, and the actual EPUB writer. It is not a visual Kindle device test.
