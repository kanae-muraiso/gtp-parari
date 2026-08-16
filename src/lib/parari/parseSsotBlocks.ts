// apps/tools/parari/src/lib/parari/parseSsotBlocks.ts
// 2026-06-21 15:00 JST
// SSOT記法パーサー v0.1
// [ACCORDION] [NOTICE] [LIST] [PROFILE] [BUTTON] [LINKS] [MENU] を意味ブロックに分解する

export type SsotVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "light"
  | "dark";

export type SsotCardRole = "notice" | "list" | "profile";

export type SsotTextBlock = {
  kind: "text";
  text: string;
};

export type SsotAccordionBlock = {
  kind: "accordion";
  title: string;
  body: string;
  headerVariant: SsotVariant;
  bodyVariant: SsotVariant;
};

export type SsotCardBlock = {
  kind: "card";
  role: SsotCardRole;
  title: string;
  body: string;
  variant: SsotVariant;
};

export type SsotButtonBlock = {
  kind: "button";
  label: string;
  url: string;
  variant: SsotVariant;
};

export type SsotLinksBlock = {
  kind: "links";
  items: {
    label: string;
    url: string;
  }[];
  variant: SsotVariant;
};

export type SsotMenuBlock = {
  kind: "menu";
  variant: SsotVariant;
};

export type SsotBlock =
  | SsotTextBlock
  | SsotAccordionBlock
  | SsotCardBlock
  | SsotButtonBlock
  | SsotLinksBlock
  | SsotMenuBlock;

type BlockTag = "ACCORDION" | "NOTICE" | "LIST" | "PROFILE";
type InlineTag = "BUTTON" | "MENU";
type LinksTag = "LINKS";
type KnownTag = BlockTag | InlineTag | LinksTag;

type OpenBlock =
  | {
      type: "accordion";
      title: string;
      bodyLines: string[];
      pendingBlankLines: number;
      headerVariant: SsotVariant;
      bodyVariant: SsotVariant;
    }
  | {
      type: "card";
      role: SsotCardRole;
      title: string;
      bodyLines: string[];
      pendingBlankLines: number;
      variant: SsotVariant;
    }
  | {
      type: "links";
      rawLines: string[];
      variant: SsotVariant;
    };

const TAG_RE =
  /^\[(ACCORDION|NOTICE|LIST|PROFILE|BUTTON|LINKS|MENU)(?::([^\]]+))?\]\s*(.*)$/i;

const PAGE_RE = /^\[PAGE\]\s*/i;

const VALID_VARIANTS: SsotVariant[] = [
  "primary",
  "secondary",
  "success",
  "danger",
  "warning",
  "info",
  "light",
  "dark",
];

const DEFAULTS = {
  accordion: {
    headerVariant: "primary" as SsotVariant,
    bodyVariant: "light" as SsotVariant,
  },
  notice: {
    variant: "warning" as SsotVariant,
  },
  list: {
    variant: "light" as SsotVariant,
  },
  profile: {
    variant: "secondary" as SsotVariant,
  },
  button: {
    variant: "primary" as SsotVariant,
  },
  links: {
    variant: "primary" as SsotVariant,
  },
  menu: {
    variant: "primary" as SsotVariant,
  },
};

function normalizeNewlines(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function isVariant(value: string | undefined | null): value is SsotVariant {
  if (!value) return false;
  return VALID_VARIANTS.includes(value.trim().toLowerCase() as SsotVariant);
}

function parseVariant(
  value: string | undefined,
  fallback: SsotVariant,
): SsotVariant {
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase();

  if (isVariant(normalized)) {
    return normalized;
  }

  return fallback;
}

function parseAccordionVariants(value: string | undefined): {
  headerVariant: SsotVariant;
  bodyVariant: SsotVariant;
} {
  if (!value) {
    return {
      headerVariant: DEFAULTS.accordion.headerVariant,
      bodyVariant: DEFAULTS.accordion.bodyVariant,
    };
  }

  const [headerRaw, bodyRaw] = value.split("/").map((part) => part.trim());

  return {
    headerVariant: parseVariant(
      headerRaw,
      DEFAULTS.accordion.headerVariant,
    ),
    bodyVariant: parseVariant(
      bodyRaw,
      DEFAULTS.accordion.bodyVariant,
    ),
  };
}

function parseButtonLine(
  raw: string,
  variant: SsotVariant,
): SsotButtonBlock | null {
  const [labelRaw, urlRaw] = raw.split("|").map((part) => part.trim());

  if (!labelRaw || !urlRaw) {
    return null;
  }

  return {
    kind: "button",
    label: labelRaw,
    url: urlRaw,
    variant,
  };
}

function parseLinkLine(raw: string): { label: string; url: string } | null {
  const [labelRaw, urlRaw] = raw.split("|").map((part) => part.trim());

  if (!labelRaw || !urlRaw) {
    return null;
  }

  return {
    label: labelRaw,
    url: urlRaw,
  };
}

function tagToCardRole(tag: KnownTag): SsotCardRole | null {
  switch (tag) {
    case "NOTICE":
      return "notice";
    case "LIST":
      return "list";
    case "PROFILE":
      return "profile";
    default:
      return null;
  }
}

function getCardDefaultVariant(role: SsotCardRole): SsotVariant {
  switch (role) {
    case "notice":
      return DEFAULTS.notice.variant;
    case "list":
      return DEFAULTS.list.variant;
    case "profile":
      return DEFAULTS.profile.variant;
  }
}

export function parseSsotBlocks(input: string): SsotBlock[] {
  const normalized = normalizeNewlines(input);
  const lines = normalized.split("\n");

  const blocks: SsotBlock[] = [];
  let textLines: string[] = [];
  let openBlock: OpenBlock | null = null;

  function flushText() {
    if (textLines.length === 0) return;

    const text = textLines.join("\n");

    if (text.trim().length > 0) {
      blocks.push({
        kind: "text",
        text,
      });
    }

    textLines = [];
  }

  function flushOpenBlock() {
    if (!openBlock) return;

    if (openBlock.type === "accordion") {
      blocks.push({
        kind: "accordion",
        title: openBlock.title.trim(),
        body: openBlock.bodyLines.join("\n").trim(),
        headerVariant: openBlock.headerVariant,
        bodyVariant: openBlock.bodyVariant,
      });
    }

    if (openBlock.type === "card") {
      blocks.push({
        kind: "card",
        role: openBlock.role,
        title: openBlock.title.trim(),
        body: openBlock.bodyLines.join("\n").trim(),
        variant: openBlock.variant,
      });
    }

    if (openBlock.type === "links") {
      const items = openBlock.rawLines
        .map((line) => parseLinkLine(line))
        .filter((item): item is { label: string; url: string } => item !== null);

      if (items.length > 0) {
        blocks.push({
          kind: "links",
          items,
          variant: openBlock.variant,
        });
      } else {
        textLines.push("[LINKS]");
        textLines.push(...openBlock.rawLines);
      }
    }

    openBlock = null;
  }

  function startTag(tag: KnownTag, variantRaw: string | undefined, rest: string) {
    if (openBlock) {
      flushOpenBlock();
    } else {
      flushText();
    }

    if (tag === "ACCORDION") {
      const variants = parseAccordionVariants(variantRaw);

      openBlock = {
        type: "accordion",
        title: rest,
        bodyLines: [],
        pendingBlankLines: 0,
        headerVariant: variants.headerVariant,
        bodyVariant: variants.bodyVariant,
      };

      return;
    }

    const cardRole = tagToCardRole(tag);

    if (cardRole) {
      openBlock = {
        type: "card",
        role: cardRole,
        title: rest,
        bodyLines: [],
        pendingBlankLines: 0,
        variant: parseVariant(variantRaw, getCardDefaultVariant(cardRole)),
      };

      return;
    }

    if (tag === "LINKS") {
      openBlock = {
        type: "links",
        rawLines: rest.trim() ? [rest] : [],
        variant: parseVariant(variantRaw, DEFAULTS.links.variant),
      };

      return;
    }

    if (tag === "BUTTON") {
      const variant = parseVariant(variantRaw, DEFAULTS.button.variant);
      const button = parseButtonLine(rest, variant);

      if (button) {
        blocks.push(button);
      } else {
        blocks.push({
          kind: "text",
          text: `[BUTTON${variantRaw ? `:${variantRaw}` : ""}]${rest}`,
        });
      }

      return;
    }

    if (tag === "MENU") {
      blocks.push({
        kind: "menu",
        variant: parseVariant(variantRaw, DEFAULTS.menu.variant),
      });

      return;
    }
  }

  for (const line of lines) {
    const tagMatch = line.match(TAG_RE);
    const isPageLine = PAGE_RE.test(line);
    const isBlank = line.trim() === "";

    /**
     * 既知タグが来たら、現在のブロックを終了して新しいタグを開始する。
     */
    if (tagMatch) {
      const tag = tagMatch[1].toUpperCase() as KnownTag;
      const variantRaw = tagMatch[2];
      const rest = tagMatch[3] ?? "";

      startTag(tag, variantRaw, rest);
      continue;
    }

    /**
     * [PAGE] が来たら、現在のSSOTブロックを強制終了する。
     * PAGE自体の処理は既存側に任せるため、ここでは通常テキストとして残す。
     */
    if (isPageLine) {
      if (openBlock) {
        flushOpenBlock();
      }

      textLines.push(line);
      continue;
    }

    /**
     * LINKSは1行1リンクのリストなので、空行1つで終了する。
     */
    if (openBlock?.type === "links") {
      if (isBlank) {
        flushOpenBlock();
        continue;
      }

      openBlock.rawLines.push(line);
      continue;
    }

    /**
     * ACCORDION / NOTICE / LIST / PROFILE は本文ブロック型。
     * 空行1つは本文内段落、空行2つで終了。
     */
    if (openBlock?.type === "accordion" || openBlock?.type === "card") {
      if (isBlank) {
        openBlock.pendingBlankLines += 1;

        if (openBlock.pendingBlankLines >= 2) {
          flushOpenBlock();
        }

        continue;
      }

      if (openBlock.pendingBlankLines === 1) {
        openBlock.bodyLines.push("");
      }

      openBlock.pendingBlankLines = 0;
      openBlock.bodyLines.push(line);
      continue;
    }

    /**
     * 通常本文。
     */
    textLines.push(line);
  }

  if (openBlock) {
    flushOpenBlock();
  }

  flushText();

  return blocks;
}
