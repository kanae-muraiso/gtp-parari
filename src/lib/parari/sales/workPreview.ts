import { buildBookSheets, isBookLikeSsot } from "@/components/parari/viewer-v2/book/buildBookSheets";
import { parseImagePanel } from "@/components/parari/panels/image/parseImagePanel";
import { renderEpubText } from "@/lib/parari/epub/renderEpubText";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";

export const PAGE_SAMPLE_LENGTH = 200;
export const MAX_PREVIEW_PAGES = 200;

type SampleBlock = { kind: "text"; text: string } | { kind: "image"; url: string; caption: string };
export type WorkPreview = { format: "book" | "page"; pages: {title: string; blocks: SampleBlock[]}[] };

function publicImage(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : null;
  } catch {
    return null;
  }
}

const decodedEntities: Record<string,string> = {"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'"};

function previewText(raw: string) {
  // The shared text converter resolves links and inline notation. Keep only
  // text visible in the reading flow, excluding ruby readings and note markers.
  return renderEpubText(raw,{notes:[],warnings:[]})
    .replace(/<(?:rp|rt)>[^<]*<\/(?:rp|rt)>|<a[^>]*role="doc-noteref"[^>]*>[^<]*<\/a>/g,"")
    .replace(/<br\s*\/?>/g,"\n")
    .replace(/<[^>]*>/g,"")
    .replace(/&(?:amp|lt|gt|quot|apos);/g,entity=>decodedEntities[entity])
    .trim();
}

function sampleBlocks(body: string, book: boolean, mainImage = ""): SampleBlock[] {
  const result: SampleBlock[] = [];
  const image = publicImage(mainImage);
  if (book && image) result.push({kind:"image",url:image,caption:""});
  let remaining = book ? Infinity : PAGE_SAMPLE_LENGTH;
  const segmenter = new Intl.Segmenter("ja", {granularity:"grapheme"});

  for (const block of parseBlocks(body)) {
    if (!remaining) break;
    if (block.kind === "text") {
      const plainText = previewText(block.raw);
      if (book) {
        if (plainText) result.push({kind:"text",text:plainText});
        continue;
      }
      let text = "";
      for (const {segment} of segmenter.segment(plainText)) {
        if (!remaining) break;
        text += segment;
        if (/\S/u.test(segment)) remaining--;
      }
      if (text) result.push({kind:"text",text});
    } else if (book && block.tag === "IMAGE") {
      const panel = parseImagePanel(block.raw, block);
      const url = publicImage(panel.url);
      if (url) result.push({kind:"image",url,caption:panel.caption});
    }
  }
  return result;
}

export function buildWorkPreview(source: string, count: number): WorkPreview {
  if (!isBookLikeSsot(source)) {
    return {format:"page", pages:[{title:"", blocks:sampleBlocks(source,false)}]};
  }
  const pages = buildBookSheets(source).pageSheets.slice(0,count).map(page=>({
    title:page.showTitle === false ? "" : page.title,
    blocks:sampleBlocks(page.bodySsot,true,page.mainImage),
  }));
  return {format:"book",pages};
}
