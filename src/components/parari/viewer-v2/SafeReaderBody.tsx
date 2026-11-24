// src/components/parari/viewer-v2/SafeReaderBody.tsx
// 2026-11-24 JST
// PART: Render compiled public reading blocks without SSOT payload

"use client";

import React from "react";
import { ViewerTextBlock } from "./ViewerTextBlock";
import { QaPanelRenderer } from "@/components/parari/panels/qa/QaPanelRenderer";
import { getPanelDefinition } from "@/components/parari/panels/registry";
import { PageTocPanel, type PageTocEntry } from "@/components/parari/reader/PageTocPanel";
import type { SafeReaderBlock } from "@/lib/parari/reader/compileReaderView";
import type { ReaderDictionaryMode, ReaderRubyMode } from "./viewerTextStyles";

type Props = {
  blocks: SafeReaderBlock[];
  className?: string;
  dictionaryMode?: ReaderDictionaryMode;
  rubyMode?: ReaderRubyMode;
};

export function SafeReaderBody({
  blocks,
  className = "",
  dictionaryMode = "off",
  rubyMode = "click",
}: Props) {
  const localId = React.useId();
  const headingIdPrefix = "parari-page-heading-" + localId;
  const headings: PageTocEntry[] = [];
  const starts: number[] = [];
  for (const block of blocks) {
    starts.push(headings.length);
    if (block.kind !== "text") continue;
    for (const paragraph of block.text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
      const line = paragraph.trim();
      const level: 2 | 3 | null = line.startsWith("### ") ? 3 : line.startsWith("## ") ? 2 : null;
      if (level && !line.includes("\n")) {
        headings.push({id: headingIdPrefix + "-" + headings.length, level,
          title: line.slice(level === 3 ? 4 : 3).replace(/\*\*([^*]+)\*\*/g,"$1").trim()});
      }
    }
  }
  return <div className="space-y-5">{blocks.map((block, index) => {
    switch (block.kind) {
      case "text":
        return <ViewerTextBlock key={index} text={block.text} className={className}
          dictionaryMode={dictionaryMode} rubyMode={rubyMode}
          headingStartIndex={starts[index]} headingIdPrefix={headingIdPrefix} />;
      case "notice":
        return <aside key={index} className="rounded-xl border-l-4 border-blue-400 bg-blue-50 px-4 py-3">
          {block.title && <strong className="block mb-2">{block.title}</strong>}
          <SafeReaderBody blocks={block.body} className={className} dictionaryMode={dictionaryMode} rubyMode={rubyMode}/>
        </aside>;
      case "accordion":
        return <details key={index} className="rounded-xl border border-neutral-200 px-4 py-3">
          <summary className="cursor-pointer font-semibold">{block.title || "続きを読む"}</summary>
          <div className="mt-3"><SafeReaderBody blocks={block.body} className={className} dictionaryMode={dictionaryMode} rubyMode={rubyMode}/></div>
        </details>;
      case "list":
        return <section key={index} className="px-2">
          {block.title && <h2 className="mb-2 font-bold">{block.title}</h2>}
          <ul className="list-disc space-y-2 pl-6">{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>
        </section>;
      case "table":
        return <div key={index} className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {block.caption && <caption className="mb-2 text-left font-semibold">{block.caption}</caption>}
            <tbody>{block.rows.map((row, r) =>
              <tr key={r}>{row.map((value, c) =>
                r === 0 && block.header
                  ? <th key={c} className="border border-neutral-200 bg-neutral-100 p-2 text-left">{value}</th>
                  : <td key={c} className="border border-neutral-200 p-2">{value}</td>)}</tr>
            )}</tbody>
          </table>
        </div>;
      case "qa":
        return <QaPanelRenderer key={index}
          block={{ id: "public-question-" + index, kind: "panel", tag: "QA", raw: "", start: 0, end: 0, implemented: true }}
          data={{
            type: block.type, attrs: "", question: block.question,
            options: block.options, answer: block.answer, guide: block.guide,
            textAnswerPlaceholder: block.placeholder, meta: "", raw: "",
          }}
        />;
      case "image": {
        const img = <img src={block.src} alt={block.caption || ""} className="w-full rounded-xl object-contain"/>;
        return <figure key={index} className="mx-auto max-w-[720px]">
          {block.link ? <a href={block.link} rel="noopener noreferrer">{img}</a> : img}
          {block.caption && <figcaption className="mt-2 text-center text-sm text-neutral-500">{block.caption}</figcaption>}
        </figure>;
      }
      case "links":
        return <nav key={index} className="flex flex-col gap-2">{block.items.map((item, i) =>
          item.url ? <a key={i} href={item.url} className="text-blue-700 underline">{item.label || item.url}</a>
          : <span key={i}>{item.label}</span>)}</nav>;
      case "button":
        return block.url
          ? <a key={index} href={block.url} className="inline-flex rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">{block.label || "開く"}</a>
          : <span key={index}>{block.label}</span>;
      case "toc":
        return <PageTocPanel key={index} entries={headings} />;
      case "carousel":
        return <div key={index} className="w-full overflow-hidden">
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
            {block.cards.map((card) => <article key={card.id}
              className="w-[82vw] max-w-[320px] shrink-0 snap-start overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:w-[320px]">
              <SafeReaderBody blocks={card.blocks} className={className}
                dictionaryMode={dictionaryMode} rubyMode={rubyMode}/>
            </article>)}
          </div>
        </div>;
      case "panel": {
        const Renderer = getPanelDefinition(block.tag).Renderer;
        return Renderer ? <Renderer key={index}
          block={{id:"reader-panel-"+index,kind:"panel",tag:block.tag,raw:"",start:0,end:0,implemented:true}}
          data={block.data} /> : null;
      }
      case "unknown":
        return <div key={index} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
          [{block.tag}] は表示用Rendererがまだありません。
        </div>;
    }
  })}</div>;
}
