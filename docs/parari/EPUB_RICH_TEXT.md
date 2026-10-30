# EPUB body text conversion

2026-10-30 JST

The exporter reads the existing SSOT notation without modifying saved content or the editor. Each PAGE/CHAPTER remains a separate spine document and starts on a new page; physical pagination remains reader-controlled.

- `## heading` and `### heading`: h2/h3; legacy `#heading#` / `##heading##` also supported.
- `**bold**`, `*italic*`, `***both***`: strong/em.
- Named and legacy color notation: monochrome strong emphasis, retaining italic modifiers. Web colors are intentionally simplified.
- `[[base|reading]]`: ruby/rt/rp; URL-shaped values keep their existing link meaning.
- `[[label]](url)` and legacy link forms: escaped hyperlinks. HTTP(S) and mailto are allowed. Root-relative PARARI links become absolute https://www.parari.app URLs. Unsupported or unresolved links retain their label and add an export warning rather than creating a broken EPUB resource or active URL.
- `[[label]]{note}`: a numbered note reference and a footnote with a return link. Numbering continues across TEXT panels within one PAGE and restarts in each content document. Notes use epub:type and accessible roles; note bodies remain plain text as in the current note editor.
- Lines beginning with `>`: adjacent lines form a blockquote. Mixed ordinary lines remain outside the quote. No quote-authoring UI or new storage tag is introduced.
- A single newline remains a line break; blank lines separate paragraphs. Unknown/malformed inline text remains text. Input HTML is escaped.

TABLE cells and image captions remain plain text. This change does not implement Kindle mode UI or new export support for other interactive panels. It does not promise identical physical pagination or reader-specific footnote popups.

Implementation references: https://www.w3.org/TR/epub-33/ and https://idpf.github.io/a11y-guidelines/content/xhtml/notes.html .

Verification: test:epub-rich-text inspects the real EPUB package, XHTML semantics, safe links, unique note IDs, every local file/fragment reference, separate PAGE numbering and table coexistence. test:epub-export covers the real authorized export route; test:table-panel preserves table behavior. The synthetic sample is independently checked with EPUBCheck. Device appearance remains a manual check.
