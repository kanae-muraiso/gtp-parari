// apps/tools/parari/src/components/parari/panels/qa/QaPanelRenderer.tsx
// apps/tools/parari/src/components/parari/panels/qa/QaPanelRenderer.tsx
// 2026-06-28 12:05 JST
// PART: QA interactive renderer / MVP answer check
// コメント:
// - QAパネルの公開表示Renderer
// - yesno / select は選択肢を選び、答え合わせできる
// - order は候補を順に選び、答え合わせできる
// - text は自由記述のためMVPでは自動判定せず、模範解答と解説へ誘導する
// - 正解/不正解の簡易効果音はWeb Audio APIで生成する

"use client";

import { useMemo, useState } from "react";
import type { PanelRendererProps } from "../panelDefinitionTypes";
import type { QaOption, QaPanelData } from "./parseQaPanel";

type CheckState = "idle" | "correct" | "incorrect" | "unjudgable";

export function QaPanelRenderer({ data }: PanelRendererProps<QaPanelData>) {
  const canAutoJudge =
    data.type === "yesno" || data.type === "select" || data.type === "order";

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-500">
          QA
        </span>

        <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">
          {getQaTypeLabel(data.type)}
        </span>
      </div>

      <div className="whitespace-pre-wrap text-base font-bold leading-7 text-neutral-900">
        {data.question || "問題文がありません。"}
      </div>

      <div className="mt-4">
        {data.type === "text" ? (
          <TextAnswerView data={data} />
        ) : data.type === "order" ? (
          <OrderAnswerView data={data} />
        ) : (
          <SelectableAnswerView data={data} />
        )}
      </div>

      {!canAutoJudge ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
          この問題は自動判定できません。模範解答と解説をご覧ください。
        </p>
      ) : null}

      {data.answer.trim().length > 0 ? (
        <details className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
          <summary className="cursor-pointer text-sm font-bold text-emerald-800">
            正解 / 模範解答
          </summary>

          <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-900">
            {data.answer}
          </div>
        </details>
      ) : null}

      {data.guide.trim().length > 0 ? (
        <details className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
          <summary className="cursor-pointer text-sm font-bold text-blue-800">
            解説
          </summary>

          <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-blue-900">
            {data.guide}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function SelectableAnswerView({ data }: { data: QaPanelData }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [checkState, setCheckState] = useState<CheckState>("idle");

  const correctIndex = useMemo(() => {
    return getCorrectOptionIndex(data);
  }, [data]);

  const selectedOption =
    selectedIndex == null ? null : data.options[selectedIndex] ?? null;

    const handleCheck = () => {
      if (selectedIndex == null) {
        return;
      }

      if (correctIndex == null) {
        setCheckState("unjudgable");
        return;
      }

      const correct = selectedIndex === correctIndex;
      setCheckState(correct ? "correct" : "incorrect");
      playQaSound(correct ? "correct" : "incorrect");
    };

  if (data.options.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500">
        選択肢がありません。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {data.options.map((option, index) => {
          const selected = selectedIndex === index;

          return (
            <button
              key={`${index}-${option.text}`}
              type="button"
              onClick={() => {
                setSelectedIndex(index);
                setCheckState("idle");
              }}
              className={[
                "w-full rounded-xl border px-3 py-2 text-left text-sm leading-6 transition",
                selected
                  ? "border-blue-300 bg-blue-50 text-blue-900 ring-2 ring-blue-100"
                  : "border-neutral-200 bg-neutral-50 text-neutral-800 hover:bg-neutral-100",
              ].join(" ")}
            >
              <span className="mr-2 text-xs font-bold text-neutral-400">
                {index + 1}
              </span>
              {option.text || "未入力の選択肢"}
            </button>
          );
        })}
      </div>

      {selectedOption ? (
        <p className="rounded-xl bg-neutral-50 px-3 py-2 text-sm leading-6 text-neutral-700">
          あなたの答え：<strong>{selectedOption.text}</strong>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCheck}
          disabled={selectedIndex == null}
          className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          答え合わせ
        </button>

        <CheckResultBadge state={checkState} />
      </div>
    </div>
  );
}

function TextAnswerView({ data }: { data: QaPanelData }) {
  const [answerText, setAnswerText] = useState("");
  const [showGuideMessage, setShowGuideMessage] = useState(false);

  return (
    <div className="space-y-3">
      <textarea
        value={answerText}
        onChange={(event) => {
          setAnswerText(event.target.value);
          setShowGuideMessage(false);
        }}
        className="min-h-[96px] w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm leading-6 text-neutral-800 outline-none focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
        placeholder={
          data.textAnswerPlaceholder || "ここに回答を入力してください。"
        }
      />

      {answerText.trim().length > 0 ? (
        <p className="rounded-xl bg-neutral-50 px-3 py-2 text-sm leading-6 text-neutral-700">
          あなたの答え：<strong>{answerText}</strong>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowGuideMessage(true)}
          className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white"
        >
          答え合わせ
        </button>

        {showGuideMessage ? (
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
            自動判定できません。模範解答と解説をご覧ください。
          </span>
        ) : null}
      </div>
    </div>
  );
}

function OrderAnswerView({ data }: { data: QaPanelData }) {
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [checkState, setCheckState] = useState<CheckState>("idle");

  const selectedText = selectedIndexes
    .map((index) => data.options[index]?.text ?? "")
    .filter((text) => text.trim().length > 0)
    .join(" ");

  const remainingOptions = data.options
    .map((option, index) => ({ option, index }))
    .filter((item) => !selectedIndexes.includes(item.index));

    const handleCheck = () => {
      if (selectedIndexes.length === 0) {
        return;
      }

      const selectedChunks = selectedIndexes
        .map((index) => data.options[index]?.text ?? "")
        .filter((text) => text.trim().length > 0);

      const correctChunks = getOrderCorrectChunks(data);

      if (correctChunks.length === 0) {
        setCheckState("unjudgable");
        return;
      }

      const correct = areSameChunkSequence(selectedChunks, correctChunks);

      setCheckState(correct ? "correct" : "incorrect");
      playQaSound(correct ? "correct" : "incorrect");
    };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <div className="mb-2 text-[11px] font-bold text-neutral-500">
          あなたの並び
        </div>

        {selectedIndexes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedIndexes.map((index, orderIndex) => (
              <button
                key={`${orderIndex}-${index}`}
                type="button"
                onClick={() => {
                  setSelectedIndexes((current) =>
                    current.filter((_, itemIndex) => itemIndex !== orderIndex),
                  );
                  setCheckState("idle");
                }}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800"
                title="クリックで戻す"
              >
                {data.options[index]?.text || "空欄"}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-400">
            下の候補を順番に選んでください。
          </p>
        )}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <div className="mb-2 text-[11px] font-bold text-neutral-500">
          並べ替え候補
        </div>

        {remainingOptions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {remainingOptions.map(({ option, index }) => (
              <button
                key={`${index}-${option.text}`}
                type="button"
                onClick={() => {
                  setSelectedIndexes((current) => [...current, index]);
                  setCheckState("idle");
                }}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 shadow-sm hover:bg-neutral-100"
              >
                {option.text || "空欄"}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-400">
            すべて選び終わりました。
          </p>
        )}
      </div>

      {selectedText ? (
        <p className="rounded-xl bg-neutral-50 px-3 py-2 text-sm leading-6 text-neutral-700">
          あなたの答え：<strong>{selectedText}</strong>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCheck}
          disabled={selectedIndexes.length === 0}
          className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          答え合わせ
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedIndexes([]);
            setCheckState("idle");
          }}
          className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-500 hover:bg-neutral-50"
        >
          やり直す
        </button>

        <CheckResultBadge state={checkState} />
      </div>
    </div>
  );
}

function CheckResultBadge({ state }: { state: CheckState }) {
  if (state === "idle") {
    return null;
  }

  if (state === "correct") {
    return (
      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
        正解です
      </span>
    );
  }

  if (state === "incorrect") {
    return (
      <span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800">
        不正解です
      </span>
    );
  }

  return (
    <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
      自動判定できません。模範解答と解説をご覧ください。
    </span>
  );
}

function getCorrectOptionIndex(data: QaPanelData): number | null {
  const explicitIndex = data.options.findIndex((option) => option.correct);

  if (explicitIndex >= 0) {
    return explicitIndex;
  }

  const answer = normalizeAnswerForCompare(data.answer);

  if (!answer) {
    return null;
  }

  const answerIndex = data.options.findIndex(
    (option) => normalizeAnswerForCompare(option.text) === answer,
  );

  return answerIndex >= 0 ? answerIndex : null;
}

function normalizeAnswerForCompare(value: string): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// apps/tools/parari/src/components/parari/panels/qa/QaPanelRenderer.tsx
// 2026-06-28 13:55 JST
// PART: getOrderCorrectChunks
// コメント:
// - 整序問題は「整序候補として登録された順番」を正解順として扱う
// - [ANS] は模範解答表示用であり、自動判定には使わない
// - 日本語のようにスペースで分解できない文でも確実に判定できる

function getOrderCorrectChunks(data: QaPanelData): string[] {
  return data.options
    .map((option) => option.text.trim())
    .filter((text) => text.length > 0);
}

function areSameChunkSequence(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    return normalizeOrderText(item) === normalizeOrderText(right[index] ?? "");
  });
}

function normalizeOrderText(value: string): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function playQaSound(kind: "correct" | "incorrect") {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const now = audioContext.currentTime;

    if (kind === "correct") {
      playTone(audioContext, now, 880, 0.12);
      playTone(audioContext, now + 0.13, 1320, 0.16);
    } else {
      playTone(audioContext, now, 180, 0.18);
      playTone(audioContext, now + 0.18, 120, 0.22);
    }

    window.setTimeout(() => {
      void audioContext.close();
    }, 700);
  } catch {
    // 音が出せない環境では無音で続行する
  }
}

function playTone(
  audioContext: AudioContext,
  startTime: number,
  frequency: number,
  duration: number,
) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

function getQaTypeLabel(type: QaPanelData["type"]): string {
  if (type === "yesno") return "Yes / No";
  if (type === "select") return "選択問題";
  if (type === "text") return "記述問題";
  if (type === "order") return "整序問題";
  return "QA";
}
