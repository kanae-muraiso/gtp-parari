// src/lib/parari/buildPublicReaderDocument.ts
// 2026-10-08 JST
// PART: Derive public reader data on the server; never transmit panel SSOT
import { buildViewerDocument, type ViewerDocumentInput } from "@/components/parari/viewer-v2/buildViewerDocument";
import { extractSplittablePageContent } from "@/components/parari/viewer-v2/book/paginateBookSheet";
import { parseBlocks } from "./ssot-v2/parseBlocks";
import { parseSsotBlocks } from "./parseSsotBlocks";
import { parseMetaFields } from "@/components/parari/panels/shared/metaFields";
import { normalizeLegacyChapterInfoRaw } from "@/components/parari/panels/chapterinfo/chapterInfoRaw";
import { resolvePanelGap } from "@/components/parari/panels/shared/panelGap";
import { parseEtTextPanelBody } from "@/components/parari/panels/ettext/etTextSsot";
import type { PanelBlock } from "./ssot-v2/panelTypes";
import type { PreparedReaderBlock } from "./readerProjectionTypes";
import { parseImagePanel } from "@/components/parari/panels/image/parseImagePanel";
import { parseVideoPanel } from "@/components/parari/panels/video/parseVideoPanel";
import { parseAudioPanel } from "@/components/parari/panels/audio/parseAudioPanel";
import { parseYoutubePanel } from "@/components/parari/panels/youtube/parseYoutubePanel";
import { parseButtonPanel } from "@/components/parari/panels/button/parseButtonPanel";
import { parseMenuPanel } from "@/components/parari/panels/menu/parseMenuPanel";
import { parseQaPanel } from "@/components/parari/panels/qa/parseQaPanel";
import { parseInstagramPanel } from "@/components/parari/panels/instagram/parseInstagramPanel";
import { parseFormPanel } from "@/components/parari/panels/form/parseFormPanel";
import { parseApplicationPanel } from "@/components/parari/panels/application/parseApplicationPanel";
import { parseCalendarPanel } from "@/components/parari/panels/calendar/parseCalendarPanel";
import { parseMembershipPanel } from "@/components/parari/panels/membership/parseMembershipPanel";
import { parseCarouselPanel } from "@/components/parari/panels/carousel/parseCarouselPanel";
const parsers: Record<string, (raw: string, block: PanelBlock) => any> = {
    IMAGE: parseImagePanel,
    VIDEO: parseVideoPanel,
    AUDIO: parseAudioPanel,
    YOUTUBE: parseYoutubePanel,
    BUTTON: parseButtonPanel,
    MENU: parseMenuPanel,
    QA: parseQaPanel,
    INSTAGRAM: parseInstagramPanel,
    FORM: parseFormPanel,
    APPLICATION: parseApplicationPanel,
    CALENDAR: parseCalendarPanel,
    MEMBERSHIP: parseMembershipPanel,
    CAROUSEL: parseCarouselPanel
};
export function prepareReaderBlocks(source: string): PreparedReaderBlock[] {
    const normalized = source.replace(/^(\s*\[TOC\])\s*$/gim, "$1\n[T]");
    return parseBlocks(normalized).filter(b => b.kind !== "panel" || b.tag !== "PAYWALL").map(block => {
        if (block.kind === "text")
            return { id: block.id, kind: "text", text: block.raw, attrs: block.attrs };
        let data: any = {};
        if (["NOTICE", "LIST", "LINKS", "ACCORDION"].includes(block.tag))
            data = { uiBlocks: parseSsotBlocks(block.raw) };
        else if (["BOOK", "PAGE", "CHAPTER"].includes(block.tag))
            data = { fields: parseMetaFields(block.tag === "CHAPTER" ? normalizeLegacyChapterInfoRaw(block.raw) : block.raw) };
        else if (block.tag === "ETTEXT")
            data = parseEtTextPanelBody(block.raw);
        else if (parsers[block.tag])
            data = parsers[block.tag](block.raw, block);
        if (block.tag === "CAROUSEL")
            data = { ...data, cards: data.cards.map((card: any) => ({ id: card.id, bodyBlocks: prepareReaderBlocks(card.bodySsot) })) };
        // Existing parsers retain raw for editor round trips. It has no public purpose.
        const { raw, rawLines, bodySsot, ...displayData } = data;
        return { id: block.id, kind: "panel", tag: block.tag, variant: block.variant, data: displayData, gap: resolvePanelGap(block) };
    });
}
export function buildPublicReaderDocument(input: ViewerDocumentInput) {
    const doc = buildViewerDocument(input);
    const prepareSheet = (sheet: typeof doc.book.sheets[number]) => ({ ...sheet, bodySsot: "", bodyBlocks: prepareReaderBlocks(sheet.bodySsot), paginationContent: extractSplittablePageContent(sheet.bodySsot) });
    const sheets = doc.book.sheets.map(prepareSheet);
    const byId = new Map(sheets.map(s => [s.id, s]));
    doc.book = { ...doc.book, sheets, pageSheets: doc.book.pageSheets.map(s => byId.get(s.id) ?? prepareSheet(s)), chapterSheets: doc.book.chapterSheets.map(s => byId.get(s.id) ?? prepareSheet(s)) };
    if (doc.web) {
        // Navigation needs page labels and slugs, never page sources.
        doc.web.parsed = { ...doc.web.parsed, webInfo: { ...doc.web.parsed.webInfo, raw: "" }, pages: doc.web.parsed.pages.map(p => ({ ...p, raw: "", containerRaw: "" })) };
        if (doc.web.selectedPage)
            doc.web.selectedPage = { ...doc.web.selectedPage, raw: "", containerRaw: "" };
    }
    return doc;
}
