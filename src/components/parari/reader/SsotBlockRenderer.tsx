// apps/tools/parari/src/components/parari/reader/SsotBlockRenderer.tsx
// 2026-06-21 15:35 JST
// SSOTブロック表示レンダラー v0.1
// parseSsotBlocks の結果を、リッチUIまたは通常表示で描画する

"use client";

import { useState } from "react";
import {
  parseSsotBlocks,
  type SsotBlock,
  type SsotVariant,
} from "@/lib/parari/parseSsotBlocks";
import RichTextRenderer from "@/components/parari/richText/RichTextRenderer";
import { parseRichText } from "@/lib/parari/richText/parseRichText";

type SsotBlockRendererProps = {
  text: string;

  /**
   * true ならリッチUI表示。
   * false なら無料作者向けの展開済み通常表示。
   */
  rich?: boolean;
};

const variantClasses: Record<
  SsotVariant,
  {
    border: string;
    bg: string;
    text: string;
    softBg: string;
    button: string;
    buttonOutline: string;
  }
> = {
  primary: {
    border: "border-blue-200",
    bg: "bg-blue-50",
    text: "text-blue-800",
    softBg: "bg-blue-50",
    button: "bg-blue-600 text-white hover:bg-blue-700",
    buttonOutline:
      "border border-blue-300 bg-white text-blue-700 hover:bg-blue-50",
  },
  secondary: {
    border: "border-neutral-200",
    bg: "bg-neutral-50",
    text: "text-neutral-700",
    softBg: "bg-neutral-50",
    button: "bg-neutral-600 text-white hover:bg-neutral-700",
    buttonOutline:
      "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50",
  },
  success: {
    border: "border-green-200",
    bg: "bg-green-50",
    text: "text-green-800",
    softBg: "bg-green-50",
    button: "bg-green-600 text-white hover:bg-green-700",
    buttonOutline:
      "border border-green-300 bg-white text-green-700 hover:bg-green-50",
  },
  danger: {
    border: "border-red-200",
    bg: "bg-red-50",
    text: "text-red-800",
    softBg: "bg-red-50",
    button: "bg-red-600 text-white hover:bg-red-700",
    buttonOutline:
      "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  },
  warning: {
    border: "border-yellow-200",
    bg: "bg-yellow-50",
    text: "text-yellow-900",
    softBg: "bg-yellow-50",
    button: "bg-yellow-400 text-yellow-950 hover:bg-yellow-500",
    buttonOutline:
      "border border-yellow-300 bg-white text-yellow-800 hover:bg-yellow-50",
  },
  info: {
    border: "border-cyan-200",
    bg: "bg-cyan-50",
    text: "text-cyan-800",
    softBg: "bg-cyan-50",
    button: "bg-cyan-500 text-white hover:bg-cyan-600",
    buttonOutline:
      "border border-cyan-300 bg-white text-cyan-700 hover:bg-cyan-50",
  },
  light: {
    border: "border-neutral-200",
    bg: "bg-white",
    text: "text-neutral-700",
    softBg: "bg-white",
    button: "bg-neutral-100 text-neutral-800 hover:bg-neutral-200",
    buttonOutline:
      "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
  },
  dark: {
    border: "border-neutral-300",
    bg: "bg-neutral-100",
    text: "text-neutral-900",
    softBg: "bg-neutral-100",
    button: "bg-neutral-900 text-white hover:bg-black",
    buttonOutline:
      "border border-neutral-500 bg-white text-neutral-900 hover:bg-neutral-100",
  },
};

function TextBlock({ text }: { text: string }) {
  return (
    <div className="text-neutral-800">
      <RichTextRenderer document={parseRichText(text)} />
    </div>
  );
}

function PlainBlock({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="my-4">
      {title ? (
        <div className="mb-2 text-sm font-semibold text-neutral-800">
          {title}
        </div>
      ) : null}

      {body ? (
        <div className="whitespace-pre-wrap text-sm leading-7 text-neutral-700">
          {body}
        </div>
      ) : null}
    </div>
  );
}

function RichCard({
  title,
  body,
  variant,
}: {
  title: string;
  body: string;
  variant: SsotVariant;
}) {
  const classes = variantClasses[variant];

  return (
    <div
      className={[
        "my-4 rounded-2xl border p-4 shadow-sm",
        classes.border,
        classes.softBg,
      ].join(" ")}
    >
      {title ? (
        <div className={["mb-2 text-sm font-semibold", classes.text].join(" ")}>
          {title}
        </div>
      ) : null}

      {body ? (
        <div className="whitespace-pre-wrap text-sm leading-7 text-neutral-700">
          {body}
        </div>
      ) : null}
    </div>
  );
}

function RichAccordion({
  title,
  body,
  headerVariant,
  bodyVariant,
}: {
  title: string;
  body: string;
  headerVariant: SsotVariant;
  bodyVariant: SsotVariant;
}) {
  const [open, setOpen] = useState(false);

  const headerClasses = variantClasses[headerVariant];
  const bodyClasses = variantClasses[bodyVariant];

  return (
    <div
      className={[
        "my-4 overflow-hidden rounded-2xl border shadow-sm",
        headerClasses.border,
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
          className={[
            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold",
            headerClasses.bg,
            headerClasses.text,
          ].join(" ")}
      >
        <span>{title}</span>
        <span className="shrink-0 text-xs">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <div
          className={[
            "whitespace-pre-wrap border-t px-4 py-3 text-sm leading-7 text-neutral-700",
            bodyClasses.softBg,
            bodyClasses.border,
          ].join(" ")}
        >
          {body}
        </div>
      ) : null}
    </div>
  );
}

function RichButton({
  label,
  url,
  variant,
}: {
  label: string;
  url: string;
  variant: SsotVariant;
}) {
  const classes = variantClasses[variant];

  return (
    <div className="my-4">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={[
          "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition",
          classes.button,
        ].join(" ")}
      >
        {label}
      </a>
    </div>
  );
}

function PlainButton({
  label,
  url,
}: {
  label: string;
  url: string;
}) {
  return (
    <div className="my-4 text-sm leading-7">
      <div className="font-semibold text-neutral-800">{label}</div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="break-all text-blue-700 underline"
      >
        {url}
      </a>
    </div>
  );
}

function RichLinks({
  items,
  variant,
}: {
  items: { label: string; url: string }[];
  variant: SsotVariant;
}) {
  const classes = variantClasses[variant];

  return (
    <div className="my-4 flex flex-wrap gap-2">
      {items.map((item, index) => (
        <a
          key={`${item.label}-${index}`}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className={[
            "inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold shadow-sm transition",
            classes.buttonOutline,
          ].join(" ")}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

function PlainLinks({
  items,
}: {
  items: { label: string; url: string }[];
}) {
  return (
    <div className="my-4 space-y-3 text-sm leading-7">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          <div className="font-semibold text-neutral-800">{item.label}</div>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="break-all text-blue-700 underline"
          >
            {item.url}
          </a>
        </div>
      ))}
    </div>
  );
}

function MenuPlaceholder({ rich }: { rich: boolean }) {
  if (rich) {
    return (
      <div className="my-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
        MENUはBOOK表示接続時に、ページ一覧から自動生成します。
      </div>
    );
  }

  return (
    <div className="my-4 whitespace-pre-wrap text-sm leading-7 text-neutral-700">
      目次
    </div>
  );
}

function renderBlock(block: SsotBlock, index: number, rich: boolean) {
  if (block.kind === "text") {
    return <TextBlock key={`text-${index}`} text={block.text} />;
  }

  if (block.kind === "card") {
    if (rich) {
      return (
        <RichCard
          key={`card-${index}`}
          title={block.title}
          body={block.body}
          variant={block.variant}
        />
      );
    }

    return (
      <PlainBlock
        key={`card-plain-${index}`}
        title={block.title}
        body={block.body}
      />
    );
  }

  if (block.kind === "accordion") {
    if (rich) {
      return (
        <RichAccordion
          key={`accordion-${index}`}
          title={block.title}
          body={block.body}
          headerVariant={block.headerVariant}
          bodyVariant={block.bodyVariant}
        />
      );
    }

    return (
      <PlainBlock
        key={`accordion-plain-${index}`}
        title={block.title}
        body={block.body}
      />
    );
  }

  if (block.kind === "button") {
    if (rich) {
      return (
        <RichButton
          key={`button-${index}`}
          label={block.label}
          url={block.url}
          variant={block.variant}
        />
      );
    }

    return (
      <PlainButton
        key={`button-plain-${index}`}
        label={block.label}
        url={block.url}
      />
    );
  }

  if (block.kind === "links") {
    if (rich) {
      return (
        <RichLinks
          key={`links-${index}`}
          items={block.items}
          variant={block.variant}
        />
      );
    }

    return (
      <PlainLinks
        key={`links-plain-${index}`}
        items={block.items}
      />
    );
  }

  if (block.kind === "menu") {
    return <MenuPlaceholder key={`menu-${index}`} rich={rich} />;
  }

  return null;
}

export function SsotBlockRenderer({
  text,
  rich = true,
}: SsotBlockRendererProps) {
  const blocks = parseSsotBlocks(text);

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => renderBlock(block, index, rich))}
    </div>
  );
}
