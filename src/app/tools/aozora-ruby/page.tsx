"use client";

import { useMemo, useState, type ReactNode } from "react";

type ConversionResult = {
  text: string;
  explicitCount: number;
  implicitCount: number;
};

const SAMPLE_TEXT = `メロスは激怒した。必ず、かの邪智暴虐《じゃちぼうぎゃく》の王を除かなければならぬと決意した。
｜暴君《ぼうくん》ディオニスは、人を信ずることができぬ。`;

export default function AozoraRubyConverterPage() {
  const [source, setSource] = useState("");
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => convertAozoraRuby(source), [source]);
  const convertedCount = result.explicitCount + result.implicitCount;

  async function copyResult() {
    if (!result.text) return;

    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadResult() {
    if (!result.text) return;

    const blob = new Blob([result.text], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "aozora-parari-ruby.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10 text-neutral-950">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8">
          <div className="text-xs font-bold tracking-[0.18em] text-sky-700">
            PARARI TOOL
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            青空文庫ルビ変換
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-600">
            青空文庫のルビ記法を、PARARIの
            <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-xs ring-1 ring-neutral-200">
              [[本文|よみ]]
            </code>
            形式へ変換します。
          </p>
        </header>

        <section className="mb-5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-7 text-sky-950">
          <div>
            <code>邪智暴虐《じゃちぼうぎゃく》</code>
            <span className="mx-2">→</span>
            <code>[[邪智暴虐|じゃちぼうぎゃく]]</code>
          </div>
          <div>
            <code>｜暴君《ぼうくん》</code>
            <span className="mx-2">→</span>
            <code>[[暴君|ぼうくん]]</code>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <TextAreaCard
            label="青空文庫テキスト"
            value={source}
            placeholder="ここへ青空文庫のテキストを貼り付けます"
            onChange={setSource}
            actions={
              <>
                <SmallButton onClick={() => setSource(SAMPLE_TEXT)}>
                  サンプル
                </SmallButton>
                <SmallButton onClick={() => setSource("")}>
                  クリア
                </SmallButton>
              </>
            }
          />

          <TextAreaCard
            label="PARARIルビ記法"
            value={result.text}
            placeholder="変換結果がここに表示されます"
            readOnly
            actions={
              <>
                <SmallButton onClick={copyResult} disabled={!result.text}>
                  {copied ? "コピーしました" : "コピー"}
                </SmallButton>
                <SmallButton onClick={downloadResult} disabled={!result.text}>
                  TXT保存
                </SmallButton>
              </>
            }
          />
        </div>

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-500">
          <span>
            変換数：
            <strong className="ml-1 text-neutral-900">{convertedCount}</strong>
            件
          </span>
          <span>
            縦線付き {result.explicitCount}件 ／ 漢字直結 {result.implicitCount}件
          </span>
        </footer>
      </div>
    </main>
  );
}

function TextAreaCard({
  label,
  value,
  placeholder,
  onChange,
  readOnly = false,
  actions,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  actions: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-neutral-100 px-4">
        <h2 className="text-sm font-bold">{label}</h2>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>

      <textarea
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        className={[
          "min-h-[62vh] w-full resize-y px-4 py-4 font-mono text-sm leading-7 outline-none",
          readOnly ? "bg-neutral-50 text-neutral-800" : "bg-white text-neutral-950",
        ].join(" ")}
        placeholder={placeholder}
        spellCheck={false}
      />
    </section>
  );
}

function SmallButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={disabled}
      className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function convertAozoraRuby(input: string): ConversionResult {
  const normalized = String(input ?? "").replace(/\r\n/g, "\n");

  let explicitCount = 0;
  let implicitCount = 0;

  const explicitConverted = normalized.replace(
    /｜([^《》\n]+)《([^《》\n]+)》/g,
    (_match, base: string, reading: string) => {
      const cleanBase = base.trim();
      const cleanReading = reading.trim();

      if (!cleanBase || !cleanReading) {
        return _match;
      }

      explicitCount += 1;
      return `[[${cleanBase}|${cleanReading}]]`;
    },
  );

  const text = explicitConverted.replace(
    /([一-龠々〆ヵヶ]+)《([^《》\n]+)》/g,
    (_match, base: string, reading: string) => {
      const cleanReading = reading.trim();

      if (!cleanReading) {
        return _match;
      }

      implicitCount += 1;
      return `[[${base}|${cleanReading}]]`;
    },
  );

  return {
    text,
    explicitCount,
    implicitCount,
  };
}
