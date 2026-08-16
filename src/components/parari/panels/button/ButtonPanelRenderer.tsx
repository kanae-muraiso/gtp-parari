// apps/tools/parari/src/components/parari/panels/button/ButtonPanelRenderer.tsx
// 2026-07-05 JST - BUTTON public renderer / align対応

import type { PanelRendererProps } from "../panelDefinitionTypes";
import type { ButtonPanelData, ButtonAlign } from "./parseButtonPanel";

const BUTTON_VARIANT_CLASSES: Record<string, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  blue: "bg-blue-600 text-white hover:bg-blue-700",
  dark: "bg-neutral-900 text-white hover:bg-neutral-700",
  black: "bg-neutral-900 text-white hover:bg-neutral-700",
  green: "bg-emerald-600 text-white hover:bg-emerald-700",
  red: "bg-rose-600 text-white hover:bg-rose-700",
  rose: "bg-rose-600 text-white hover:bg-rose-700",
  amber: "bg-amber-500 text-white hover:bg-amber-600",
  yellow: "bg-amber-500 text-white hover:bg-amber-600",
  outline:
    "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50",
  light:
    "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
};

export function ButtonPanelRenderer({
  data,
}: PanelRendererProps<ButtonPanelData>) {
  const label = data.label.trim();
  const url = sanitizeButtonUrl(data.url);
  const variant = String(data.variant ?? "dark").trim().toLowerCase();
  const align = normalizeButtonAlign(data.align);

  if (!label && !url) {
    return null;
  }

  const justifyClass = getButtonAlignClass(align);
  const buttonClass =
    BUTTON_VARIANT_CLASSES[variant] ?? BUTTON_VARIANT_CLASSES.dark;

  const body = (
    <span
      className={[
        "inline-flex max-w-full items-center justify-center rounded-full px-5 py-2.5",
        "text-sm font-bold leading-5 shadow-sm transition",
        buttonClass,
      ].join(" ")}
    >
      {label || url}
    </span>
  );

  return (
    <div className={["my-4 flex w-full", justifyClass].join(" ")}>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="max-w-full">
          {body}
        </a>
      ) : (
        body
      )}
    </div>
  );
}

function normalizeButtonAlign(value: unknown): ButtonAlign {
  if (value === "center" || value === "right") {
    return value;
  }

  return "left";
}

function getButtonAlignClass(align: ButtonAlign): string {
  if (align === "center") {
    return "justify-center";
  }

  if (align === "right") {
    return "justify-end";
  }

  return "justify-start";
}

function sanitizeButtonUrl(value: string): string {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  if (/^(https?:|mailto:|tel:)/i.test(text)) {
    return text;
  }

  if (text.startsWith("/")) {
    return text;
  }

  return "";
}
