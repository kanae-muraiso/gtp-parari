// apps/tools/parari/src/components/parari/panels/qa/parseQaPanel.ts
// apps/tools/parari/src/components/parari/panels/qa/parseQaPanel.ts
// 2026-06-29 17:20 JST
// PART: QA parser accepts square and curly child tags
// コメント:
// - [Q] / {Q} の両方を読む
// - [A] / {A} の両方を読む
// - [ANS] / {ANS} / [GUIDE] / {GUIDE} / [META] / {META} に対応
// - serializerは今まで通り [] でよい

export type QaType = "yesno" | "select" | "text" | "order";

export type QaOption = {
  text: string;
  correct: boolean;
};

export type QaPanelData = {
  type: QaType;
  attrs: string;
  question: string;
  options: QaOption[];
  textAnswerPlaceholder: string;
  answer: string;
  guide: string;
  meta: string;
  raw: string;
};

const KNOWN_QA_TYPES = new Set<QaType>([
  "yesno",
  "select",
  "text",
  "order",
]);

type QaSection = "Q" | "A" | "ANS" | "GUIDE" | "META";

export function parseQaPanel(raw: string): QaPanelData {
  const normalized = raw.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  const firstLine = lines[0] ?? "";
  const headerMatch = firstLine.match(/^\[QA(?::([^\]\s]+))?([^\]]*)?\]\s*$/);

  const rawType = headerMatch?.[1]?.trim() ?? "select";
  const type: QaType = KNOWN_QA_TYPES.has(rawType as QaType)
    ? (rawType as QaType)
    : "select";

  const attrs = headerMatch?.[2]?.trim() ?? "";

  const sectionLines: Record<QaSection, string[]> = {
    Q: [],
    A: [],
    ANS: [],
    GUIDE: [],
    META: [],
  };

  let currentSection: QaSection | null = null;

  for (const line of lines.slice(1)) {
    const sectionMatch = matchQaSectionLine(line);

    if (sectionMatch) {
      currentSection = sectionMatch.section;

      if (sectionMatch.inlineValue.length > 0) {
        sectionLines[currentSection].push(sectionMatch.inlineValue);
      }

      continue;
    }

    if (currentSection) {
      sectionLines[currentSection].push(line);
    }
  }

  const question = sectionLines.Q.join("\n").trim();
  const answer = sectionLines.ANS.join("\n").trim();
  const guide = sectionLines.GUIDE.join("\n").trim();
  const meta = sectionLines.META.join("\n").trim();

  const options = parseQaOptions(sectionLines.A, type, answer);
  const textAnswerPlaceholder =
    type === "text"
      ? sectionLines.A.join("\n").trim() || "ここに回答を入力してください。"
      : "";

  return {
    type,
    attrs,
    question,
    options,
    textAnswerPlaceholder,
    answer,
    guide,
    meta,
    raw,
  };
}

function matchQaSectionLine(
  line: string,
): { section: QaSection; inlineValue: string } | null {
  const match = line.match(/^\s*[\[\{](Q|A|ANS|GUIDE|META)[\]\}]\s*(.*)$/i);

  if (!match) {
    return null;
  }

  return {
    section: match[1].toUpperCase() as QaSection,
    inlineValue: match[2] ?? "",
  };
}

function parseQaOptions(
  lines: string[],
  type: QaType,
  answer: string
): QaOption[] {
  const cleanedLines = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (type === "text") {
    return [];
  }

  if (type === "order") {
    if (cleanedLines.length > 0) {
      return cleanedLines.map((line) => ({
        text: line,
        correct: false,
      }));
    }

    /**
     * [A] が空で [ANS] だけある場合の最低限の補助。
     * 英文整序ならスペース分割で候補を作る。
     */
    return answer
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item) => ({
        text: item,
        correct: false,
      }));
  }

  if (type === "yesno" && cleanedLines.length === 0) {
    return [
      { text: "はい", correct: false },
      { text: "いいえ", correct: false },
    ];
  }

  return cleanedLines.map((line) => {
    const correct = line.startsWith("*");
    const text = correct ? line.slice(1).trim() : line;

    return {
      text,
      correct,
    };
  });
}
