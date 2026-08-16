// src/app/tools/aozora/page.tsx
// 2026/07/20 11:20

"use client";

import { FormEvent, useState } from "react";

type HeadingTag =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6";

type FetchSuccess = {
  ok: true;
  requestedUrl: string;
  sourceType: "card" | "xhtml";
  card: {
    url: string;
    pageTitle: string | null;
    title: string | null;
    author: string | null;
    hasCopyrightWarning: boolean;
  } | null;
    xhtml: {
      url: string;
      contentType: string;
      charset: string;
      byteLength: number;
      pageTitle: string | null;
    };
    
  analysis: {
    documentTitle: string | null;
    headingCounts: Record<HeadingTag, number>;
    headingTotal: number;
    paragraphCount: number;
    rubyCount: number;
    imageCount: number;
    pageBreakCandidateCount: number;
    characterCount: number;
    rubySamples: Array<{
      base: string;
      reading: string;
    }>;
    headingSamples: Array<{
      tag: string;
      text: string;
    }>;
      
      outline: Array<{
        type:
          | "TITLE"
          | "AUTHOR"
          | "HEADING"
          | "TEXT"
          | "IMAGE"
          | "PAGE_BREAK";

        text?: string;
        level?: number;
        src?: string;
        alt?: string;

        characterCount?: number;
        preview?: string;
        mergeCandidate?: boolean;

        mergeDirection?:
          | "PREVIOUS"
          | "NEXT"
          | null;

        mergeReason?: string;
      }>;

      outlineCounts: {
        title: number;
        author: number;
        heading: number;
        text: number;
        image: number;
        pageBreak: number;
      };
      
  };
};

type FetchFailure = {
  ok: false;
  error: string;
};

type FetchResult = FetchSuccess | FetchFailure;

type InputSource =
  | "AOZORA"
  | "GUTENBERG"
  | "PLAIN_TEXT";

type EditableBlockType =
  | "TEXT"
  | "BOOK"
  | "CHAPTER"
  | "PAGE"
  | "H2"
  | "H3"
  | "IGNORE";

type OriginalOutlineBlockType =
  | "TITLE"
  | "AUTHOR"
  | "HEADING"
  | "TEXT"
  | "IMAGE"
  | "PAGE_BREAK";

type BookBlockData = {
  title: string;
  subtitle: string;
  author: string;
  coverImage: string;
  cover: boolean;
  titlePage: boolean;
  toc: boolean;
  workType: "book";
  renderMode: "page" | "scroll";
  defaultReadingMode: "paged" | "scroll";
  physicalPagination: boolean;
};

type ChapterBlockData = {
  title: string;
  subtitle: string;
  toc: boolean;
  pageBreakBefore: boolean;
};

type PageBlockData = {
  title: string;
  showTitle: boolean;
  pageNumber: "auto" | "none";
};

type HeadingBlockData = {
  text: string;
  toc: boolean;
};

type EditableOutlineBlock = {
  id: string;

  originalType: OriginalOutlineBlockType;
  originalText: string;

  type: EditableBlockType;
  text: string;

  src?: string;
  alt?: string;
  level?: number;

  book?: BookBlockData;
  chapter?: ChapterBlockData;
  page?: PageBlockData;
  heading?: HeadingBlockData;

  isEditing: boolean;
};

function booleanToSsot(value: boolean): string {
  return value ? "true" : "false";
}

function escapeSsotMetadata(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

function createSsotText(
  blocks: EditableOutlineBlock[],
): string {
  const output: string[] = [];

  for (const block of blocks) {
    if (block.type === "IGNORE") {
      continue;
    }

    if (block.type === "BOOK") {
      const book = block.book;

      if (!book) {
        continue;
      }

      const title =
        book.title.trim() ||
        block.text.trim() ||
        "無題";

      output.push(`[BOOK] ${title}`);
      output.push(
        `title: ${escapeSsotMetadata(title)}`,
      );

      if (book.subtitle.trim()) {
        output.push(
          `subtitle: ${escapeSsotMetadata(
            book.subtitle,
          )}`,
        );
      }

      if (book.author.trim()) {
        output.push(
          `author: ${escapeSsotMetadata(
            book.author,
          )}`,
        );
      }

      if (book.coverImage.trim()) {
        output.push(
          `coverImage: ${book.coverImage.trim()}`,
        );
      }

      output.push(
        `cover: ${booleanToSsot(book.cover)}`,
      );
      output.push(
        `titlePage: ${booleanToSsot(
          book.titlePage,
        )}`,
      );
      output.push(
        `toc: ${booleanToSsot(book.toc)}`,
      );
      output.push(`workType: ${book.workType}`);
      output.push(`renderMode: ${book.renderMode}`);
      output.push(
        `defaultReadingMode: ${book.defaultReadingMode}`,
      );
      output.push(
        `physicalPagination: ${booleanToSsot(
          book.physicalPagination,
        )}`,
      );
      output.push("");

      continue;
    }

    if (block.type === "CHAPTER") {
      const chapterTitle =
        block.chapter?.title.trim() ||
        block.text.trim();

      if (!chapterTitle) {
        continue;
      }

      output.push(`[CHAPTER] ${chapterTitle}`);

      const subtitle =
        block.chapter?.subtitle.trim() ?? "";

      if (subtitle) {
        output.push(
          `subtitle: ${escapeSsotMetadata(
            subtitle,
          )}`,
        );
      }

      if (block.chapter) {
        output.push(
          `toc: ${booleanToSsot(
            block.chapter.toc,
          )}`,
        );
        output.push(
          `pageBreakBefore: ${booleanToSsot(
            block.chapter.pageBreakBefore,
          )}`,
        );
      }

      output.push("");

      continue;
    }

    if (block.type === "PAGE") {
      const pageTitle =
        block.page?.title.trim() ||
        block.text.trim();

      output.push(
        pageTitle ? `[PAGE] ${pageTitle}` : "[PAGE]",
      );

      if (block.page) {
        output.push(
          `showTitle: ${booleanToSsot(
            block.page.showTitle,
          )}`,
        );
        output.push(
          `pageNumber: ${block.page.pageNumber}`,
        );
      }

      output.push("");

      continue;
    }

    if (block.type === "H2") {
      const headingText =
        block.heading?.text.trim() ||
        block.text.trim();

      if (!headingText) {
        continue;
      }

      output.push(`[H2] ${headingText}`);

      if (block.heading) {
        output.push(
          `toc: ${booleanToSsot(
            block.heading.toc,
          )}`,
        );
      }

      output.push("");

      continue;
    }

    if (block.type === "H3") {
      const headingText =
        block.heading?.text.trim() ||
        block.text.trim();

      if (!headingText) {
        continue;
      }

      output.push(`[H3] ${headingText}`);

      if (block.heading) {
        output.push(
          `toc: ${booleanToSsot(
            block.heading.toc,
          )}`,
        );
      }

      output.push("");

      continue;
    }

    if (block.type === "TEXT") {
      const text = block.text.trim();

      if (!text) {
        continue;
      }

      output.push("[T]");
      output.push(text);
      output.push("");
    }
  }

  return output.join("\n").trimEnd() + "\n";
}

function sanitizeSsotFileName(
  value: string,
): string {
  const sanitized = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ");

  return sanitized || "parari-book";
}

const BLOCK_TYPE_OPTIONS: Array<{
  value: EditableBlockType;
  label: string;
  shortLabel: string;
}> = [
  {
    value: "TEXT",
    label: "本文",
    shortLabel: "T",
  },
  {
    value: "BOOK",
    label: "BOOKタイトル",
    shortLabel: "BOOK",
  },
  {
    value: "CHAPTER",
    label: "CHAPTERタイトル",
    shortLabel: "CHAPTER",
  },
  {
    value: "PAGE",
    label: "PAGEタイトル",
    shortLabel: "PAGE",
  },
  {
    value: "H2",
    label: "H2",
    shortLabel: "H2",
  },
  {
    value: "H3",
    label: "H3",
    shortLabel: "H3",
  },
  {
    value: "IGNORE",
    label: "除外",
    shortLabel: "除外",
  },
];

function createDefaultBookData(
  title: string,
  author = "",
): BookBlockData {
  return {
    title,
    subtitle: "",
    author,
    coverImage: "",
    cover: true,
    titlePage: true,
    toc: true,
    workType: "book",
    renderMode: "page",
    defaultReadingMode: "paged",
    physicalPagination: true,
  };
}

function createDefaultChapterData(
  title: string,
): ChapterBlockData {
  return {
    title,
    subtitle: "",
    toc: true,
    pageBreakBefore: true,
  };
}

function createDefaultPageData(
  title: string,
): PageBlockData {
  return {
    title,
    showTitle: true,
    pageNumber: "auto",
  };
}

function createDefaultHeadingData(
  text: string,
): HeadingBlockData {
  return {
    text,
    toc: true,
  };
}

type ApiOutlineBlock = {
  type: OriginalOutlineBlockType;
  text?: string;
  level?: number;
  src?: string;
  alt?: string;
};

function createEditableOutline(
  outline: ApiOutlineBlock[],
): EditableOutlineBlock[] {
  return outline.map((block, index) => {
    const originalText = block.text ?? "";

    /*
     * 青空文庫解析上のTITLE・AUTHOR・HEADINGも、
     * 編集画面ではいったん本文として扱います。
     *
     * 編集者がBOOK、CHAPTER、PAGE、H2、H3を
     * 明示的に選びます。
     */
    let initialType: EditableBlockType = "TEXT";

    /*
     * 画像や改ページは、今回の編集対象ではありません。
     * 現時点では除外扱いにします。
     *
     * 後ほどIMAGE、PAGE_BREAK専用表示を追加できます。
     */
    if (
      block.type === "IMAGE" ||
      block.type === "PAGE_BREAK"
    ) {
      initialType = "IGNORE";
    }

    return {
      id: `aozora-block-${index}`,
      originalType: block.type,
      originalText,

      type: initialType,
      text: originalText,

      src: block.src,
      alt: block.alt,
      level: block.level,

      isEditing: false,
    };
  });
}

function createEditableOutlineFromText(
  sourceText: string,
  source: "GUTENBERG" | "PLAIN_TEXT",
): EditableOutlineBlock[] {
  const normalizedText = sourceText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const blocks: EditableOutlineBlock[] = [];
  let textBuffer: string[] = [];
  let blockCounter = 0;

  const flushTextBuffer = () => {
    if (textBuffer.length === 0) {
      return;
    }

    const text = textBuffer.join("\n").trim();

    textBuffer = [];

    if (!text) {
      return;
    }

    blocks.push({
      id: `${source.toLowerCase()}-block-${blockCounter}`,
      originalType: "TEXT",
      originalText: text,
      type: "TEXT",
      text,
      isEditing: false,
    });

    blockCounter += 1;
  };

  const lines = normalizedText.split("\n");

  for (const line of lines) {
    /*
     * フォームフィードは原文の改ページとして残す。
     *
     * 1行の途中に含まれている場合にも対応するため、
     * \fで分割して前後を別のTブロックとして扱う。
     */
    const pageParts = line.split("\f");

    pageParts.forEach((part, partIndex) => {
      if (part) {
        textBuffer.push(part);
      }

      const hasPageBreak =
        partIndex < pageParts.length - 1;

      if (hasPageBreak) {
        flushTextBuffer();

        blocks.push({
          id: `${source.toLowerCase()}-page-break-${blockCounter}`,
          originalType: "PAGE_BREAK",
          originalText: "",
          type: "IGNORE",
          text: "",
          isEditing: false,
        });

        blockCounter += 1;
      }
    });

    /*
     * Enterで区切られた論理行を1つのTとして確定する。
     *
     * 空行はブロックを作らず、前のTを確定する境界として扱う。
     */
    flushTextBuffer();
  }

  flushTextBuffer();

  return blocks;
}

function changeEditableBlockType(
  block: EditableOutlineBlock,
  nextType: EditableBlockType,
  detectedAuthor: string,
): EditableOutlineBlock {
  const sourceText =
    block.text ||
    block.originalText ||
    "";

  switch (nextType) {
    case "BOOK":
      return {
        ...block,
        type: "BOOK",
        book:
          block.book ??
          createDefaultBookData(
            sourceText,
            detectedAuthor,
          ),
        isEditing: false,
      };

    case "CHAPTER":
      return {
        ...block,
        type: "CHAPTER",
        chapter:
          block.chapter ??
          createDefaultChapterData(sourceText),
        isEditing: false,
      };

    case "PAGE":
      return {
        ...block,
        type: "PAGE",
        page:
          block.page ??
          createDefaultPageData(sourceText),
        isEditing: false,
      };

    case "H2":
    case "H3":
      return {
        ...block,
        type: nextType,
        heading:
          block.heading ??
          createDefaultHeadingData(sourceText),
        isEditing: false,
      };

    case "TEXT":
    case "IGNORE":
      return {
        ...block,
        type: nextType,
        isEditing: false,
      };

    default:
      return block;
  }
}

type BooleanSelectProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

function BooleanSelect({
  value,
  onChange,
  disabled = false,
}: BooleanSelectProps) {
  return (
    <select
      value={value ? "true" : "false"}
      disabled={disabled}
      onChange={(event) => {
        onChange(event.target.value === "true");
      }}
      className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm disabled:bg-neutral-100"
    >
      <option value="true">true</option>
      <option value="false">false</option>
    </select>
  );
}

type BookBlockPanelProps = {
  block: EditableOutlineBlock;
  onChange: (
    updater: (
      current: EditableOutlineBlock,
    ) => EditableOutlineBlock,
  ) => void;
};

function BookBlockPanel({
  block,
  onChange,
}: BookBlockPanelProps) {
  const book = block.book;

  if (!book) {
    return (
      <p className="text-sm text-red-600">
        BOOKデータを作成できませんでした。
      </p>
    );
  }

  const updateBook = (
    patch: Partial<BookBlockData>,
  ) => {
    onChange((current) => ({
      ...current,
      book: {
        ...(current.book ?? book),
        ...patch,
      },
    }));
  };

  if (!block.isEditing) {
    return (
      <button
        type="button"
        onClick={() => {
          onChange((current) => ({
            ...current,
            isEditing: true,
          }));
        }}
        className="w-full rounded-lg border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-400"
      >
        <div className="space-y-1 font-mono text-sm leading-6">
          <p>
            <span className="font-bold">
              title:
            </span>{" "}
            {book.title}
          </p>

          <p>
            <span className="font-bold">
              subtitle:
            </span>{" "}
            {book.subtitle}
          </p>

          <p>
            <span className="font-bold">
              author:
            </span>{" "}
            {book.author}
          </p>

          <p>
            <span className="font-bold">
              coverImage:
            </span>{" "}
            {book.coverImage}
          </p>

          <p>
            <span className="font-bold">
              cover:
            </span>{" "}
            {String(book.cover)}
          </p>

          <p>
            <span className="font-bold">
              titlePage:
            </span>{" "}
            {String(book.titlePage)}
          </p>

          <p>
            <span className="font-bold">
              toc:
            </span>{" "}
            {String(book.toc)}
          </p>

          <p>
            <span className="font-bold">
              workType:
            </span>{" "}
            {book.workType}
          </p>

          <p>
            <span className="font-bold">
              renderMode:
            </span>{" "}
            {book.renderMode}
          </p>

          <p>
            <span className="font-bold">
              defaultReadingMode:
            </span>{" "}
            {book.defaultReadingMode}
          </p>

          <p>
            <span className="font-bold">
              physicalPagination:
            </span>{" "}
            {String(book.physicalPagination)}
          </p>
        </div>

        <p className="mt-4 text-xs text-neutral-500">
          クリックして編集
        </p>
      </button>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-blue-300 bg-blue-50/40 p-4">
      <BookTextField
        label="title"
        value={book.title}
        onChange={(value) => {
          updateBook({ title: value });
        }}
      />

      <BookTextField
        label="subtitle"
        value={book.subtitle}
        onChange={(value) => {
          updateBook({ subtitle: value });
        }}
      />

      <BookTextField
        label="author"
        value={book.author}
        onChange={(value) => {
          updateBook({ author: value });
        }}
      />

      <BookTextField
        label="coverImage"
        value={book.coverImage}
        onChange={(value) => {
          updateBook({ coverImage: value });
        }}
      />

      <BookSelectRow label="cover">
        <BooleanSelect
          value={book.cover}
          onChange={(value) => {
            updateBook({ cover: value });
          }}
        />
      </BookSelectRow>

      <BookSelectRow label="titlePage">
        <BooleanSelect
          value={book.titlePage}
          onChange={(value) => {
            updateBook({
              titlePage: value,
            });
          }}
        />
      </BookSelectRow>

      <BookSelectRow label="toc">
        <BooleanSelect
          value={book.toc}
          onChange={(value) => {
            updateBook({ toc: value });
          }}
        />
      </BookSelectRow>

      <BookSelectRow label="workType">
        <select
          value={book.workType}
          disabled
          className="rounded-md border border-neutral-300 bg-neutral-100 px-2 py-1 text-sm"
        >
          <option value="book">book</option>
        </select>
      </BookSelectRow>

      <BookSelectRow label="renderMode">
        <select
          value={book.renderMode}
          onChange={(event) => {
            updateBook({
              renderMode:
                event.target.value === "scroll"
                  ? "scroll"
                  : "page",
            });
          }}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
        >
          <option value="page">page</option>
          <option value="scroll">scroll</option>
        </select>
      </BookSelectRow>

      <BookSelectRow label="defaultReadingMode">
        <select
          value={book.defaultReadingMode}
          onChange={(event) => {
            updateBook({
              defaultReadingMode:
                event.target.value === "scroll"
                  ? "scroll"
                  : "paged",
            });
          }}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
        >
          <option value="paged">paged</option>
          <option value="scroll">scroll</option>
        </select>
      </BookSelectRow>

      <BookSelectRow label="physicalPagination">
        <BooleanSelect
          value={book.physicalPagination}
          onChange={(value) => {
            updateBook({
              physicalPagination: value,
            });
          }}
        />
      </BookSelectRow>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            onChange((current) => ({
              ...current,
              isEditing: false,
            }));
          }}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
        >
          決定
        </button>
      </div>
    </div>
  );
}

type TextBlockPanelProps = {
  block: EditableOutlineBlock;
  onChange: (
    updater: (
      current: EditableOutlineBlock,
    ) => EditableOutlineBlock,
  ) => void;
};

function TextBlockPanel({
  block,
  onChange,
}: TextBlockPanelProps) {
  const [draftText, setDraftText] =
    useState(block.text);

  if (!block.isEditing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraftText(block.text);

          onChange((current) => ({
            ...current,
            isEditing: true,
          }));
        }}
        className="w-full rounded-lg border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-400"
      >
        <p className="whitespace-pre-wrap leading-8">
          {block.text ||
            "内容を取得できませんでした"}
        </p>

        <p className="mt-3 text-xs font-semibold text-blue-600">
          クリックして本文を編集
        </p>
      </button>
    );
  }

  return (
    <div className="rounded-lg border-2 border-blue-400 bg-white p-4">
      <textarea
        value={draftText}
        onChange={(event) => {
          setDraftText(event.target.value);
        }}
        rows={8}
        autoFocus
        className="min-h-40 w-full resize-y rounded-md border border-neutral-300 px-3 py-3 font-mono text-sm leading-7 outline-none focus:border-blue-500"
      />

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setDraftText(block.text);

            onChange((current) => ({
              ...current,
              isEditing: false,
            }));
          }}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700"
        >
          取消
        </button>

        <button
          type="button"
          onClick={() => {
            onChange((current) => ({
              ...current,
              text: draftText,
              isEditing: false,
            }));
          }}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
        >
          決定
        </button>
      </div>
    </div>
  );
}

type BookTextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function BookTextField({
  label,
  value,
  onChange,
}: BookTextFieldProps) {
  return (
    <label className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
      <span className="font-mono text-sm font-bold text-neutral-700">
        {label}:
      </span>

      <input
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
      />
    </label>
  );
}

type BookSelectRowProps = {
  label: string;
  children: React.ReactNode;
};

function BookSelectRow({
  label,
  children,
}: BookSelectRowProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
      <span className="font-mono text-sm font-bold text-neutral-700">
        {label}:
      </span>

      <div>{children}</div>
    </div>
  );
}

function sourceTypeLabel(
  sourceType: FetchSuccess["sourceType"],
): string {
  return sourceType === "card"
    ? "図書カードから解析"
    : "XHTML本文を直接解析";
}

function CountCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <dt className="text-sm font-medium text-neutral-500">
        {label}
      </dt>

      <dd className="mt-2 text-2xl font-bold">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

function outlineTypeLabel(
  type:
    | "TITLE"
    | "AUTHOR"
    | "HEADING"
    | "TEXT"
    | "IMAGE"
    | "PAGE_BREAK",
): string {
  switch (type) {
    case "TITLE":
      return "作品名";

    case "AUTHOR":
      return "著者";

    case "HEADING":
      return "見出し";

    case "TEXT":
      return "本文";

    case "IMAGE":
      return "画像";

    case "PAGE_BREAK":
      return "改ページ";
  }
}

export default function AozoraToolPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] =
    useState<FetchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
    
    const [
      editableOutline,
      setEditableOutline,
    ] = useState<EditableOutlineBlock[]>([]);
    
    const [inputSource, setInputSource] =
      useState<InputSource>("AOZORA");

    const [externalText, setExternalText] =
      useState("");
    
    function handleDownloadSsot() {
      if (editableOutline.length === 0) {
        window.alert(
          "出力するアウトラインがありません。",
        );
        return;
      }

      const bookBlock = editableOutline.find(
        (block) =>
          block.type === "BOOK" && block.book,
      );

      const bookTitle =
        bookBlock?.book?.title.trim() ||
        bookBlock?.text.trim() ||
        "parari-book";

      const ssotText =
        createSsotText(editableOutline);

      if (!ssotText.trim()) {
        window.alert(
          "SSOTへ出力できるブロックがありません。",
        );
        return;
      }

      const blob = new Blob([ssotText], {
        type: "text/plain;charset=utf-8",
      });

      const objectUrl =
        URL.createObjectURL(blob);

      const anchor =
        document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = `${sanitizeSsotFileName(
        bookTitle,
      )}.ssot.txt`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(objectUrl);
    }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setResult({
        ok: false,
        error: "URLを入力してください。",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        "/api/internal/aozora/fetch",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: trimmedUrl,
          }),
        },
      );

      const data = (await response.json()) as FetchResult;
      setResult(data);
        
        setResult(data);

        if ("analysis" in data) {
          const nextOutline = createEditableOutline(
            data.analysis.outline ?? [],
          );

          setEditableOutline(nextOutline);
        } else {
          setEditableOutline([]);
        }
        
    } catch {
      setResult({
        ok: false,
        error: "PARARIのAPIへ接続できませんでした。",
      });
    } finally {
      setIsLoading(false);
    }
  }
    
    function handleExternalTextImport() {
      if (!externalText.trim()) {
        window.alert(
          inputSource === "GUTENBERG"
            ? "Gutenbergの本文を貼り付けてください。"
            : "テキストを貼り付けてください。",
        );

        return;
      }

      const source =
        inputSource === "GUTENBERG"
          ? "GUTENBERG"
          : "PLAIN_TEXT";

      const nextOutline =
        createEditableOutlineFromText(
          externalText,
          source,
        );

      if (nextOutline.length === 0) {
        window.alert(
          "編集できるテキストを取得できませんでした。",
        );

        return;
      }

      setEditableOutline(nextOutline);

        
    }
    
    const detectedAuthor =
      result && "analysis" in result
        ? result.analysis.outline?.find(
            (block) => block.type === "AUTHOR",
          )?.text ?? ""
        : "";

    function updateEditableBlock(
      blockId: string,
      updater: (
        current: EditableOutlineBlock,
      ) => EditableOutlineBlock,
    ) {
      setEditableOutline((currentBlocks) =>
        currentBlocks.map((block) =>
          block.id === blockId
            ? updater(block)
            : block,
        ),
      );
    }

    function handleBlockTypeChange(
      blockId: string,
      nextType: EditableBlockType,
    ) {
      updateEditableBlock(
        blockId,
        (currentBlock) =>
          changeEditableBlockType(
            currentBlock,
            nextType,
            detectedAuthor,
          ),
      );
    }
    
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10 text-neutral-900">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="mb-2 text-sm font-medium text-neutral-500">
            PARARI INTERNAL TOOLS
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            PARARI文庫作成
          </h1>

          <p className="mt-3 leading-7 text-neutral-600">
            図書カードまたはXHTML本文のURLから、
            作品の基本構造を確認します。
            保存・変換・公開は行いません。
          </p>
        </header>

          <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7">
            <h2 className="text-lg font-bold">
              入力元
            </h2>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setInputSource("AOZORA");
                }}
                className={
                  inputSource === "AOZORA"
                    ? "rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white"
                    : "rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                }
              >
                青空文庫
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputSource("GUTENBERG");
                }}
                className={
                  inputSource === "GUTENBERG"
                    ? "rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white"
                    : "rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                }
              >
                Gutenberg
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputSource("PLAIN_TEXT");
                }}
                className={
                  inputSource === "PLAIN_TEXT"
                    ? "rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white"
                    : "rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                }
              >
                外部テキスト
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-neutral-500">
              入力方法が違っても、解析後は同じPARARI原稿編集画面を使用します。
            </p>
          </section>
       
          {inputSource === "AOZORA" && (
            <>
          
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <form onSubmit={handleSubmit}>
            <label
              htmlFor="aozora-url"
              className="block text-sm font-semibold"
            >
              青空文庫URL
            </label>

            <input
              id="aozora-url"
              type="url"
              value={url}
              onChange={(event) =>
                setUrl(event.target.value)
              }
              placeholder="https://www.aozora.gr.jp/cards/..."
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 outline-none transition focus:border-neutral-600 focus:ring-2 focus:ring-neutral-200"
            />

            <p className="mt-2 text-sm text-neutral-500">
              図書カードを指定した場合は、XHTML本文を自動的に探します。
            </p>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-neutral-900 px-6 py-3 font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "解析中…" : "解析する"}
            </button>
          </form>
        </section>
          
          </>
        )}

          
          {inputSource !== "AOZORA" && (
            <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7">
              <div>
                <h2 className="text-xl font-bold">
                  {inputSource === "GUTENBERG"
                    ? "Project Gutenberg本文"
                    : "外部テキスト"}
                </h2>

                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  {inputSource === "GUTENBERG"
                    ? "Project Gutenbergから取得したプレーンテキストを貼り付けてください。"
                    : "PARARIで構造化したい長文テキストを貼り付けてください。"}
                </p>
              </div>

              <textarea
                value={externalText}
                onChange={(event) => {
                  setExternalText(event.target.value);
                }}
                rows={18}
                placeholder={
                  inputSource === "GUTENBERG"
                    ? "Project Gutenbergの本文をここへ貼り付けます。"
                    : "原稿や長文テキストをここへ貼り付けます。"
                }
                className="mt-5 min-h-80 w-full resize-y rounded-xl border border-neutral-300 bg-white px-4 py-4 font-mono text-sm leading-7 outline-none focus:border-blue-500"
              />

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleExternalTextImport}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  編集画面へ取り込む
                </button>

                <p className="text-xs text-neutral-500">
                  Enterで区切られた各行をTパネルとして取り込みます。
                </p>
              </div>
            </section>
          )}
          
          
          {inputSource === "AOZORA" &&
            result &&
            result.ok === false && (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <h2 className="font-bold text-red-900">
              解析できませんでした
            </h2>

            <p className="mt-2 text-red-800">
              {result.error}
            </p>
          </section>
        )}

          {inputSource === "AOZORA" &&
            result?.ok && (
          <div className="mt-8 space-y-6">
            <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-neutral-500">
                    {sourceTypeLabel(result.sourceType)}
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    {result.card?.title ||
                      result.analysis.documentTitle ||
                      result.xhtml.pageTitle ||
                      "作品名を検出できませんでした"}
                  </h2>

                  {result.card?.author && (
                    <p className="mt-2 text-neutral-600">
                      {result.card.author}
                    </p>
                  )}
                </div>

                {result.card?.hasCopyrightWarning && (
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900">
                    著作権表示を確認してください
                  </span>
                )}
              </div>

                        <dl className="mt-6 grid gap-5 sm:grid-cols-3">
                          <div>
                            <dt className="text-sm font-medium text-neutral-500">
                              XHTMLページタイトル
                            </dt>

                            <dd className="mt-1 font-semibold">
                              {result.xhtml.pageTitle ||
                                "検出できませんでした"}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-sm font-medium text-neutral-500">
                              検出文字コード
                            </dt>

                            <dd className="mt-1 font-mono font-semibold">
                              {result.xhtml.charset}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-sm font-medium text-neutral-500">
                              データ量
                            </dt>

                            <dd className="mt-1">
                              {result.xhtml.byteLength.toLocaleString()} bytes
                            </dd>
                          </div>
                        </dl>

              <div className="mt-6">
                <p className="text-sm font-medium text-neutral-500">
                  XHTML本文URL
                </p>

                <p className="mt-1 break-all font-mono text-sm">
                  {result.xhtml.url}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7">
              <h2 className="text-xl font-bold">
                基本解析
              </h2>

              <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <CountCard
                  label="見出し"
                  value={result.analysis.headingTotal}
                />

                <CountCard
                  label="本文段落"
                  value={result.analysis.paragraphCount}
                />

                <CountCard
                  label="ルビ"
                  value={result.analysis.rubyCount}
                />

                <CountCard
                  label="画像"
                  value={result.analysis.imageCount}
                />

                <CountCard
                  label="改ページ候補"
                  value={
                    result.analysis.pageBreakCandidateCount
                  }
                />

                <CountCard
                  label="本文文字数"
                  value={result.analysis.characterCount}
                />
              </dl>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7">
              <h2 className="text-xl font-bold">
                見出し内訳
              </h2>

              <dl className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {(
                  [
                    "h1",
                    "h2",
                    "h3",
                    "h4",
                    "h5",
                    "h6",
                  ] as HeadingTag[]
                ).map((tag) => (
                  <CountCard
                    key={tag}
                    label={tag.toUpperCase()}
                    value={
                      result.analysis.headingCounts[tag]
                    }
                  />
                ))}
              </dl>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7">
                <h2 className="text-xl font-bold">
                  見出しサンプル
                </h2>

                {result.analysis.headingSamples.length >
                0 ? (
                  <div className="mt-5 space-y-3">
                    {result.analysis.headingSamples.map(
                      (heading, index) => (
                        <div
                          key={`${heading.tag}-${index}`}
                          className="flex gap-3 rounded-xl bg-neutral-50 p-3"
                        >
                          <span className="shrink-0 font-mono text-xs font-bold uppercase text-neutral-500">
                            {heading.tag}
                          </span>

                          <span>{heading.text}</span>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-neutral-500">
                    見出し要素は検出されませんでした。
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7">
                <h2 className="text-xl font-bold">
                  ルビ変換サンプル
                </h2>

                {result.analysis.rubySamples.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    {result.analysis.rubySamples.map(
                      (ruby, index) => (
                        <div
                          key={`${ruby.base}-${index}`}
                          className="rounded-xl bg-neutral-50 p-3"
                        >
                          <p>
                            <span className="font-semibold">
                              {ruby.base}
                            </span>

                            <span className="mx-2 text-neutral-300">
                              →
                            </span>

                            <code className="text-sm">
                              [[{ruby.base}|{ruby.reading}]]
                            </code>
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-neutral-500">
                    ルビは検出されませんでした。
                  </p>
                )}
              </div>
            </section>


                        
            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-7">
              <h2 className="font-bold text-blue-950">
                現在は解析のみです
              </h2>

              <p className="mt-2 leading-7 text-blue-900">
                この解析結果はPARARI作品へ保存されておらず、
                公開処理も行っていません。
              </p>
            </section>
          </div>
        )}
          
          <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">
                PARARI原稿編集
              </h2>

              <p className="mt-2 text-sm leading-6 text-neutral-500">
                取り込んだ文章をT・BOOK・CHAPTER・PAGEへ整理します。
              </p>
            </div>

            <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm font-semibold text-neutral-700">
              {editableOutline.length.toLocaleString()}
              ブロック
            </span>
          </div>
          
            

            <div className="mt-7 space-y-2">
          
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadSsot}
              disabled={editableOutline.length === 0}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              SSOTテキストを出力
            </button>

            <p className="text-xs text-neutral-500">
              IGNOREに設定したブロックは出力されません。
            </p>
          </div>
          
          {editableOutline.length > 0 ? (
            <div className="space-y-4">
              {editableOutline.map((block) => {
                const option =
                  BLOCK_TYPE_OPTIONS.find(
                    (item) => item.value === block.type,
                  ) ?? BLOCK_TYPE_OPTIONS[0];

                return (
                  <section
                    key={block.id}
                    className={
                      block.type === "IGNORE"
                        ? "rounded-xl border border-dashed border-neutral-300 bg-neutral-100 p-4 opacity-60"
                        : block.type === "BOOK"
                          ? "rounded-xl border-2 border-blue-400 bg-blue-50 p-4"
                          : "rounded-xl border border-neutral-200 bg-neutral-50 p-4"
                    }
                  >
                    <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                      <div>
                        <select
                          value={block.type}
                          onChange={(event) => {
                            handleBlockTypeChange(
                              block.id,
                              event.target.value as EditableBlockType,
                            );
                          }}
                          className="w-full rounded-md border border-neutral-400 bg-neutral-900 px-2 py-2 text-xs font-bold text-white"
                        >
                          {BLOCK_TYPE_OPTIONS.map((item) => (
                            <option
                              key={item.value}
                              value={item.value}
                            >
                              {item.label}
                            </option>
                          ))}
                        </select>

                        <div className="mt-2 grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              handleBlockTypeChange(
                                block.id,
                                "CHAPTER",
                              );
                            }}
                            className={
                              block.type === "CHAPTER"
                                ? "rounded-md bg-amber-500 px-2 py-2 text-[11px] font-bold text-white"
                                : "rounded-md border border-amber-300 bg-white px-2 py-2 text-[11px] font-bold text-amber-700 hover:bg-amber-50"
                            }
                          >
                            CHAPTER
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleBlockTypeChange(
                                block.id,
                                "PAGE",
                              );
                            }}
                            className={
                              block.type === "PAGE"
                                ? "rounded-md bg-blue-600 px-2 py-2 text-[11px] font-bold text-white"
                                : "rounded-md border border-blue-300 bg-white px-2 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
                            }
                          >
                            PAGE
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleBlockTypeChange(
                                block.id,
                                "TEXT",
                              );
                            }}
                            className={
                              block.type === "TEXT"
                                ? "rounded-md bg-neutral-800 px-2 py-2 text-[11px] font-bold text-white"
                                : "rounded-md border border-neutral-300 bg-white px-2 py-2 text-[11px] font-bold text-neutral-700 hover:bg-neutral-100"
                            }
                          >
                            T
                          </button>
                        </div>
                        <p className="mt-2 font-mono text-xs text-neutral-500">
                          [{option.shortLabel}]
                        </p>

                        <p className="mt-2 text-xs text-neutral-500">
                          元の種類：{block.originalType}
                        </p>
                      </div>

                      <div className="min-w-0">
                        {block.type === "BOOK" && (
                          <BookBlockPanel
                            block={block}
                            onChange={(updater) => {
                              updateEditableBlock(
                                block.id,
                                updater,
                              );
                            }}
                          />
                        )}

                        {block.type === "TEXT" && (
                          <TextBlockPanel
                            block={block}
                            onChange={(updater) => {
                              updateEditableBlock(
                                block.id,
                                updater,
                              );
                            }}
                          />
                        )}

                        {block.type !== "BOOK" &&
                          block.type !== "TEXT" &&
                          block.type !== "IGNORE" && (
                            <p
                              className={
                                block.type === "CHAPTER"
                                  ? "text-xl font-bold"
                                  : block.type === "PAGE"
                                    ? "text-lg font-bold"
                                    : block.type === "H2"
                                      ? "text-lg font-bold"
                                      : block.type === "H3"
                                        ? "font-bold"
                                        : "whitespace-pre-wrap leading-8"
                              }
                            >
                              {block.text ||
                                "内容を取得できませんでした"}
                            </p>
                          )}

                        {block.type === "IGNORE" && (
                          <p className="whitespace-pre-wrap text-neutral-500 line-through">
                            {block.text ||
                              "除外されたブロック"}
                          </p>
                        )}

                        <details className="mt-4">
                          <summary className="cursor-pointer text-xs text-neutral-500">
                            元の解析情報
                          </summary>

                          <div className="mt-2 rounded-md bg-white p-3 font-mono text-xs leading-6 text-neutral-600">
                            <p>
                              originalType:{" "}
                              {block.originalType}
                            </p>

                            {block.level && (
                              <p>
                                level: {block.level}
                              </p>
                            )}

                            {block.src && (
                              <p className="break-all">
                                src: {block.src}
                              </p>
                            )}

                            {block.alt && (
                              <p>
                                alt: {block.alt}
                              </p>
                            )}

                            <p className="whitespace-pre-wrap">
                              originalText:{" "}
                              {block.originalText ||
                                "なし"}
                            </p>
                          </div>
                        </details>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl bg-neutral-50 p-4 text-neutral-500">
              アウトラインを生成できませんでした。
            </p>
          )}
            </div>
          </section>
          
      </div>
    </main>
  );
}
