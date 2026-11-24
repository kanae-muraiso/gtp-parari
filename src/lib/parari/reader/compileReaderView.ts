// src/lib/parari/reader/compileReaderView.ts
// 2026-11-24 JST
// PART: Server-side reader projection, separate from saved SSOT
// コメント:
// - 保存SSOTを変更しない。公開可能と認可済みの作品のみ呼び出し元が渡す。
// - 読者へ渡すのは表示要素と読書ナビゲーション情報だけ。
// - 未対応パネルを検出したら null とし、機能欠落を起こす切替を防ぐ。

import "server-only";
import { hasBookPageRefs } from "@/lib/parari/book/pageRefs";
import { buildViewerDocument, type ViewerDocument } from "@/components/parari/viewer-v2/buildViewerDocument";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
import { parseNoticePanel } from "@/components/parari/panels/notice/parseNoticePanel";
import { parseListPanel } from "@/components/parari/panels/list/parseListPanel";
import { parseAccordionPanel } from "@/components/parari/panels/accordion/parseAccordionPanel";
import { parseQaPanel } from "@/components/parari/panels/qa/parseQaPanel";
import { parseTablePanel } from "@/components/parari/panels/table/tableSsot";
import { parseImagePanel } from "@/components/parari/panels/image/parseImagePanel";
import { parseLinksPanel } from "@/components/parari/panels/links/parseLinksPanel";
import { parseButtonPanel } from "@/components/parari/panels/button/parseButtonPanel";
import type { PanelBlock } from "@/lib/parari/ssot-v2/panelTypes";
import { parseVideoPanel } from "@/components/parari/panels/video/parseVideoPanel";
import { parseAudioPanel } from "@/components/parari/panels/audio/parseAudioPanel";
import { parseYoutubePanel } from "@/components/parari/panels/youtube/parseYoutubePanel";
import { parseInstagramPanel } from "@/components/parari/panels/instagram/parseInstagramPanel";
import { parseApplicationPanel } from "@/components/parari/panels/application/parseApplicationPanel";
import { parseCalendarPanel } from "@/components/parari/panels/calendar/parseCalendarPanel";
import { parseMembershipPanel } from "@/components/parari/panels/membership/parseMembershipPanel";
import { parseFormPanel } from "@/components/parari/panels/form/parseFormPanel";
import { parseMenuPanel } from "@/components/parari/panels/menu/parseMenuPanel";
import { parseMarkdownPanel } from "@/components/parari/panels/markdown/markdownSsot";
import { parseEtTextPanelBody } from "@/components/parari/panels/ettext/etTextSsot";
import { parseCarouselPanel } from "@/components/parari/panels/carousel/parseCarouselPanel";


export type SafeReaderBlock =
  | { kind: "text"; text: string }
  | { kind: "notice" | "accordion"; title: string; body: SafeReaderBlock[] }
  | { kind: "list"; title: string; items: string[] }
  | { kind: "table"; caption: string; header: boolean; rows: string[][] }
  | { kind: "qa"; type: "yesno" | "select" | "text" | "order"; question: string; options: { text: string; correct: boolean }[]; answer: string; guide: string; placeholder: string }
  | { kind: "image"; src: string; caption: string; link: string }
  | { kind: "links"; items: { label: string; url: string }[] }
  | { kind: "button"; label: string; url: string }
  | { kind: "panel"; tag: "VIDEO" | "AUDIO" | "YOUTUBE" | "INSTAGRAM" | "APPLICATION" | "CALENDAR" | "MEMBERSHIP" | "FORM" | "MENU" | "MARKDOWN" | "ETTEXT"; data: Record<string, unknown> }
  | { kind: "carousel"; cards: { id: string; blocks: SafeReaderBlock[] }[] }
  | { kind: "toc" }
  | { kind: "unknown"; tag: string };

export type CompiledReaderView = {
  document: ViewerDocument;
  blocksBySheetId: Record<string, SafeReaderBlock[]>;
};

// URL values are reader-facing attributes, never executable protocols.
function safeUrl(value: string): string {
  const raw = String(value ?? "").trim();
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function compileBlocks(body: string, depth = 0): SafeReaderBlock[] | null {
  if (depth > 5) return null;
  const output: SafeReaderBlock[] = [];
  for (const block of parseBlocks(body)) {
    if (block.kind === "text") {
      if (block.raw.trim()) output.push({ kind: "text", text: block.raw });
      continue;
    }
    const panel = block as PanelBlock;
    switch (panel.tag) {
      case "PAGE": case "PAGEINFO": case "BOOK": case "BOOKINFO":
      case "CHAPTER": case "CHAPTERINFO": case "WEB": case "WEBINFO":
        // Structural metadata is not reader-facing text.
        break;
      case "TOC":
        output.push({kind:"toc"});
        break;
      case "NOTICE": {
        const data = parseNoticePanel(panel.raw, panel);
        const nested = compileBlocks(data.body, depth + 1);
        if (!nested) return null;
        output.push({ kind: "notice", title: data.title, body: nested });
        break;
      }
      case "ACCORDION": {
        const data = parseAccordionPanel(panel.raw, panel);
        const nested = compileBlocks(data.body, depth + 1);
        if (!nested) return null;
        output.push({ kind: "accordion", title: data.title, body: nested });
        break;
      }
      case "LIST": {
        const data = parseListPanel(panel.raw);
        output.push({ kind: "list", title: data.title, items: data.items });
        break;
      }
      case "TABLE": {
        const data = parseTablePanel(panel.raw);
        output.push({ kind: "table", caption: data.caption, header: data.header, rows: data.rows });
        break;
      }
      case "QA": {
        const data = parseQaPanel(panel.raw);
        output.push({
          kind: "qa", type: data.type, question: data.question,
          options: data.options.map(o => ({ text: o.text, correct: o.correct })),
          answer: data.answer, guide: data.guide, placeholder: data.textAnswerPlaceholder,
        });
        break;
      }
      case "IMAGE": {
        const data = parseImagePanel(panel.raw, panel);
        // Empty IMAGE panels are valid legacy authoring placeholders.
        // They must not make the entire work unreadable.
        const src = safeUrl(data.url);
        output.push({ kind: "image", src, caption: data.caption, link: safeUrl(data.linkUrl) });
        break;
      }
      case "LINKS": {
        const data = parseLinksPanel(panel.raw, panel);
        output.push({ kind: "links", items: data.items.map(i => ({ label: i.label, url: safeUrl(i.url) })) });
        break;
      }
      case "BUTTON": {
        const data = parseButtonPanel(panel.raw, panel);
        output.push({ kind: "button", label: data.label, url: safeUrl(data.url) });
        break;
      }
      case "VIDEO": {
        const data = parseVideoPanel(panel.raw, panel);
        output.push({kind:"panel",tag:"VIDEO",data:{
          url:safeUrl(data.url),title:data.title,poster:safeUrl(data.poster),
          aspect:data.aspect,videoWidth:data.videoWidth,caption:data.caption,
          loop:data.loop,muted:data.muted,
        }});
        break;
      }
      case "AUDIO": {
        const data = parseAudioPanel(panel.raw, panel);
        output.push({kind:"panel",tag:"AUDIO",data:{
          url:safeUrl(data.url),title:data.title,audioWidth:data.audioWidth,
          caption:data.caption,transcript:data.transcript,
        }});
        break;
      }
      case "YOUTUBE": {
        const data = parseYoutubePanel(panel.raw, panel);
        output.push({kind:"panel",tag:"YOUTUBE",data:{
          url:safeUrl(data.url),title:data.title,aspect:data.aspect,
          youtubeWidth:data.youtubeWidth,caption:data.caption,
        }});
        break;
      }
      case "INSTAGRAM": {
        const data = parseInstagramPanel(panel.raw);
        output.push({kind:"panel",tag:"INSTAGRAM",data:{
          url:safeUrl(data.url),title:data.title,caption:data.caption,
          thumbnail:safeUrl(data.thumbnail),aspect:data.aspect,
          instagramWidth:data.instagramWidth,displayMode:data.displayMode,
        }});
        break;
      }
      case "APPLICATION":
        output.push({kind:"panel",tag:"APPLICATION",data:{
          applicationId:parseApplicationPanel(panel.raw).applicationId,
        }});
        break;
      case "CALENDAR":
        output.push({kind:"panel",tag:"CALENDAR",data:{
          calendarItemId:parseCalendarPanel(panel.raw).calendarItemId,
        }});
        break;
      case "FORM":
        output.push({kind:"panel",tag:"FORM",data:{
          formId:parseFormPanel(panel.raw).formId,
        }});
        break;
      case "MEMBERSHIP":
        output.push({kind:"panel",tag:"MEMBERSHIP",data:{
          recruitmentId:parseMembershipPanel(panel.raw).recruitmentId,
        }});
        break;
      case "MENU": {
        const data = parseMenuPanel(panel.raw, panel);
        output.push({kind:"panel",tag:"MENU",data:{
          variant:data.variant,width:data.width,
          items:data.items.map(item=>({label:item.label,url:safeUrl(item.url)||"#"})),
        }});
        break;
      }
      case "MARKDOWN": {
        const data = parseMarkdownPanel(panel.raw);
        output.push({kind:"panel",tag:"MARKDOWN",data:{
          source:data.source,format:data.format,
        }});
        break;
      }
      case "ETTEXT": {
        const data = parseEtTextPanelBody(panel.raw);
        output.push({kind:"panel",tag:"ETTEXT",data:{
          type:"ETTEXT",audioUrl:safeUrl(data.audioUrl),text:data.text,
          segments:data.segments.map(seg=>({
            id:seg.id,charStart:seg.charStart,charEnd:seg.charEnd,
            audioStart:seg.audioStart,audioEnd:seg.audioEnd,selectedText:seg.selectedText,
          })),
        }});
        break;
      }
      case "CAROUSEL": {
        const data = parseCarouselPanel(panel.raw, panel);
        const cards: { id:string; blocks:SafeReaderBlock[] }[] = [];
        for(const card of data.cards) {
          const compiled = compileBlocks(card.bodySsot, depth+1);
          if (!compiled) return null;
          cards.push({id:card.id,blocks:compiled});
        }
        output.push({kind:"carousel",cards});
        break;
      }
      default:
        // Unknown panels have no registered reader UI. Match the existing
        // viewer's placeholder without exposing their source syntax.
        output.push({kind:"unknown",tag:panel.tag});
        break;
    }
  }
  return output;
}

export function compileReaderView(
  ssot: string,
  workId: string,
  options: { pageSlug?: string | null; publicBasePath?: string; headerLogoUrl?: string | null } = {},
): CompiledReaderView | null {
  try {
    // Referenced PAGEs require server-side entitlement-aware resolution.
    // Keep the legacy reader until that pipeline has a compiled equivalent.
    if (hasBookPageRefs(ssot)) return null;
    const parsed = buildViewerDocument({
      content: ssot,
      workId,
      pageSlug: options.pageSlug ?? null,
      publicBasePath: options.publicBasePath ?? "",
      headerLogoUrl: options.headerLogoUrl ?? null,
    });
    const blocksBySheetId: Record<string, SafeReaderBlock[]> = {};
    for (const sheet of parsed.book.sheets) {
      const compiled = compileBlocks(sheet.bodySsot);
      if (!compiled) return null;
      blocksBySheetId[sheet.id] = compiled;
    }
    // Make a deep copy to avoid mutating the real viewer document. No
    // raw SSOT, embedded panel tag, WEBPAGE container or source property
    // should survive in the public projection.
    const document: ViewerDocument = {
      ...parsed,
      book: {
        ...parsed.book,
        sheets: parsed.book.sheets.map(sheet => ({ ...sheet, bodySsot: "" })),
        pageSheets: parsed.book.pageSheets.map(sheet => ({ ...sheet, bodySsot: "" })),
        chapterSheets: parsed.book.chapterSheets.map(sheet => ({ ...sheet, bodySsot: "" })),
        physicalPagination: false,
      },
      web: parsed.web ? {
        ...parsed.web,
        parsed: {
          ...parsed.web.parsed,
          webInfo: { ...parsed.web.parsed.webInfo, raw: "" },
          pages: parsed.web.parsed.pages.map(page => ({ ...page, raw: "", containerRaw: "" })),
        },
        selectedPage: parsed.web.selectedPage
          ? { ...parsed.web.selectedPage, raw: "", containerRaw: "" } : null,
      } : null,
    };
    return { document, blocksBySheetId };
  } catch {
    return null;
  }
}
