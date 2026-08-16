// apps/tools/parari/src/components/parari/panels/qa/QaPanelEditor.tsx
// apps/tools/parari/src/components/parari/panels/qa/QaPanelEditor.tsx
// 2026-06-23 JST - QA editor / order整序問題MVP追加

"use client";

import { useEffect, useMemo, useState } from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import type { QaOption, QaPanelData, QaType } from "./parseQaPanel";
import { serializeQaPanel } from "./serializeQaPanel";

const QA_TYPES: Array<{
  type: QaType;
  label: string;
}> = [
  { type: "yesno", label: "Yes / No" },
  { type: "select", label: "選択問題" },
  { type: "text", label: "記述問題" },
];

export function QaPanelEditor({
  block,
  data,
  onChangeRaw,
}: PanelEditorProps<QaPanelData>) {
  const [draftData, setDraftData] = useState<QaPanelData>(data);

  useEffect(() => {
    setDraftData(data);
  }, [data.raw]);

  const commitData = (nextData: QaPanelData = draftData) => {
    onChangeRaw?.(serializeQaPanel(nextData));
  };

  const updateDraftData = (partial: Partial<QaPanelData>) => {
    setDraftData((current) => ({
      ...current,
      ...partial,
    }));
  };

  const updateAndCommitData = (nextData: QaPanelData) => {
    setDraftData(nextData);
    commitData(nextData);
  };

  const updateType = (type: QaType) => {
    if (type === draftData.type) {
      return;
    }

    if (type === "yesno") {
      updateAndCommitData({
        ...draftData,
        type,
        options: [
          { text: "はい", correct: false },
          { text: "いいえ", correct: false },
        ],
        textAnswerPlaceholder: "",
      });
      return;
    }

    if (type === "select") {
      updateAndCommitData({
        ...draftData,
        type,
        options:
          draftData.options.length > 0
            ? draftData.options
            : [
                { text: "選択肢1", correct: true },
                { text: "選択肢2", correct: false },
              ],
        textAnswerPlaceholder: "",
      });
      return;
    }

    if (type === "text") {
      updateAndCommitData({
        ...draftData,
        type,
        options: [],
        textAnswerPlaceholder:
          draftData.textAnswerPlaceholder || "ここに回答を入力してください。",
      });
      return;
    }

    if (type === "order") {
      const answer = draftData.answer.trim() || "I went to Kyoto yesterday.";
      const options =
        draftData.options.length > 0
          ? draftData.options.map((option) => ({
              text: option.text,
              correct: false,
            }))
          : answer.split(/\s+/).map((word) => ({
              text: word,
              correct: false,
            }));

      updateAndCommitData({
        ...draftData,
        type,
        options,
        answer,
        textAnswerPlaceholder: "",
      });
    }
  };

  const updateDraftOption = (index: number, nextOption: QaOption) => {
    setDraftData((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? nextOption : option
      ),
    }));
  };

  const addOption = () => {
    updateAndCommitData({
      ...draftData,
      options: [...draftData.options, { text: "", correct: false }],
    });
  };

  const removeOption = (index: number) => {
    updateAndCommitData({
      ...draftData,
      options: draftData.options.filter((_, optionIndex) => optionIndex !== index),
    });
  };

  const moveOption = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;

    if (nextIndex < 0 || nextIndex >= draftData.options.length) {
      return;
    }

    const nextOptions = [...draftData.options];
    const current = nextOptions[index];
    const target = nextOptions[nextIndex];

    if (!current || !target) {
      return;
    }

    nextOptions[index] = target;
    nextOptions[nextIndex] = current;

    updateAndCommitData({
      ...draftData,
      options: nextOptions,
    });
  };

  const setCorrectOption = (index: number) => {
    updateAndCommitData({
      ...draftData,
      options: draftData.options.map((option, optionIndex) => ({
        ...option,
        correct: optionIndex === index,
      })),
      answer: draftData.options[index]?.text ?? draftData.answer,
    });
  };

  const raw = serializeQaPanel(draftData);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-[1fr_180px]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-neutral-500">
            問題タイプ
          </span>

          <select
            value={draftData.type}
            onChange={(event) => updateType(event.target.value as QaType)}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            {QA_TYPES.map((item) => (
              <option key={item.type} value={item.type}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-neutral-500">
            attrs 任意
          </span>

          <input
            value={draftData.attrs}
            onChange={(event) =>
              updateDraftData({
                attrs: event.target.value,
              })
            }
            onBlur={(event) =>
              commitData({
                ...draftData,
                attrs: event.currentTarget.value,
              })
            }
            placeholder="level=easy"
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-bold text-neutral-500">
          問題文
        </span>

        <textarea
          value={draftData.question}
          onChange={(event) =>
            updateDraftData({
              question: event.target.value,
            })
          }
          onBlur={(event) =>
            commitData({
              ...draftData,
              question: event.currentTarget.value,
            })
          }
          placeholder="問題文を入力してください。"
          className="min-h-[70px] w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </label>

      {draftData.type === "text" ? (
        <TextAnswerEditor
          value={draftData.textAnswerPlaceholder}
          onChange={(textAnswerPlaceholder) =>
            updateDraftData({
              textAnswerPlaceholder,
            })
          }
          onBlur={(textAnswerPlaceholder) =>
            commitData({
              ...draftData,
              textAnswerPlaceholder,
            })
          }
        />
      ) : (
        <OptionsEditor
          blockId={block.id}
          type={draftData.type}
          options={draftData.options}
          onChangeOption={updateDraftOption}
          onCommit={() => commitData()}
          onAddOption={addOption}
          onRemoveOption={removeOption}
          onMoveOption={moveOption}
          onSetCorrectOption={setCorrectOption}
        />
      )}

      <label className="block">
        <span className="mb-1 block text-[11px] font-bold text-neutral-500">
          正解 / 模範解答
        </span>

        <textarea
          value={draftData.answer}
          onChange={(event) =>
            updateDraftData({
              answer: event.target.value,
            })
          }
          onBlur={(event) =>
            commitData({
              ...draftData,
              answer: event.currentTarget.value,
            })
          }
          placeholder={
            draftData.type === "order"
              ? "I went to Kyoto yesterday."
              : "正解または模範解答"
          }
          className="min-h-[70px] w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] font-bold text-neutral-500">
          解説 任意
        </span>

        <textarea
          value={draftData.guide}
          onChange={(event) =>
            updateDraftData({
              guide: event.target.value,
            })
          }
          onBlur={(event) =>
            commitData({
              ...draftData,
              guide: event.currentTarget.value,
            })
          }
          placeholder="解説を入力してください。"
          className="min-h-[70px] w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </label>

      {draftData.type === "order" ? (
        <OrderQuestionPreview data={draftData} />
      ) : (
        <BasicPreview data={draftData} />
      )}


    </div>
  );
}

function TextAnswerEditor({
  value,
  onChange,
  onBlur,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-neutral-500">
        回答欄の案内文
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlur(event.currentTarget.value)}
        placeholder="ここに回答を入力してください。"
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function OptionsEditor({
  blockId,
  type,
  options,
  onChangeOption,
  onCommit,
  onAddOption,
  onRemoveOption,
  onMoveOption,
  onSetCorrectOption,
}: {
  blockId: string;
  type: QaType;
  options: QaOption[];
  onChangeOption: (index: number, option: QaOption) => void;
  onCommit: () => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
  onMoveOption: (index: number, direction: "up" | "down") => void;
  onSetCorrectOption: (index: number) => void;
}) {
  const isOrder = type === "order";
  const isSelectable = type === "select" || type === "yesno";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-neutral-500">
          {isOrder ? "整序候補" : "選択肢"}
        </span>

        <button
          type="button"
          onClick={onAddOption}
          className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] font-bold text-neutral-600 hover:bg-neutral-50"
        >
          追加
        </button>
      </div>

      {options.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-400">
          候補がありません。
        </div>
      ) : (
        options.map((option, index) => (
          <div
            key={`${blockId}-qa-option-${index}`}
            className="grid gap-2 md:grid-cols-[auto_1fr_auto]"
          >
            {isSelectable ? (
              <label className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 text-xs text-neutral-500">
                <input
                  type="radio"
                  checked={option.correct}
                  onChange={() => onSetCorrectOption(index)}
                />
                正解
              </label>
            ) : (
              <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50 px-2 text-xs text-neutral-400">
                {index + 1}
              </div>
            )}

                                        <input
                                          value={option.text}
                                          onChange={(event) =>
                                            onChangeOption(index, {
                                              ...option,
                                              text: event.target.value,
                                            })
                                          }
                                          onBlur={onCommit}
                                          placeholder={isOrder ? "並べ替える語句" : "選択肢"}
                                          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        />

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onMoveOption(index, "up")}
                disabled={index === 0}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-500 hover:bg-neutral-50 disabled:opacity-30"
              >
                ↑
              </button>

              <button
                type="button"
                onClick={() => onMoveOption(index, "down")}
                disabled={index === options.length - 1}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-500 hover:bg-neutral-50 disabled:opacity-30"
              >
                ↓
              </button>

              <button
                type="button"
                onClick={() => onRemoveOption(index)}
                className="rounded-md border border-red-100 bg-red-50 px-2 py-1 text-[11px] text-red-600 hover:bg-red-100"
              >
                削除
              </button>
            </div>
          </div>
        ))
      )}

      {isOrder ? (
        <p className="text-[11px] leading-5 text-neutral-400">
          同じ単語が複数ある場合でも、採点は表示文字列の順序で行うため、どちらを選んでも正解になります。
        </p>
      ) : null}
    </div>
  );
}

function BasicPreview({ data }: { data: QaPanelData }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-2 text-[11px] font-bold text-neutral-400">
        表示プレビュー
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <div className="whitespace-pre-wrap text-sm font-bold leading-6 text-neutral-900">
          {data.question || "問題文がありません。"}
        </div>

        {data.type === "text" ? (
          <input
            readOnly
            value=""
            placeholder={data.textAnswerPlaceholder || "回答欄"}
            className="mt-3 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
          />
        ) : (
          <div className="mt-3 space-y-2">
            {data.options.map((option, index) => (
              <div
                key={`preview-${index}`}
                className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700"
              >
                {option.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderQuestionPreview({ data }: { data: QaPanelData }) {
  const sourceItems = useMemo(
    () =>
      data.options
        .map((option) => option.text.trim())
        .filter((item) => item.length > 0),
    [data.options]
  );

  const initialItems = useMemo(
    () => createOrderItems(sourceItems, data.answer),
    [sourceItems, data.answer]
  );

  const [availableItems, setAvailableItems] = useState<OrderItem[]>(initialItems);
  const [answerItems, setAnswerItems] = useState<OrderItem[]>([]);
  const [resultMessage, setResultMessage] = useState("");

  useEffect(() => {
    setAvailableItems(initialItems);
    setAnswerItems([]);
    setResultMessage("");
  }, [initialItems]);

  const reset = () => {
    setAvailableItems(createOrderItems(sourceItems, data.answer));
    setAnswerItems([]);
    setResultMessage("");
  };

  const addToAnswer = (item: OrderItem) => {
    setAvailableItems((current) =>
      current.filter((currentItem) => currentItem.id !== item.id)
    );
    setAnswerItems((current) => [...current, item]);
    setResultMessage("");
  };

  const removeFromAnswer = (item: OrderItem) => {
    setAnswerItems((current) =>
      current.filter((currentItem) => currentItem.id !== item.id)
    );
    setAvailableItems((current) => [...current, item]);
    setResultMessage("");
  };

    const checkAnswer = () => {
      const userTokens = answerItems
        .map((item) => normalizeOrderToken(item.label))
        .filter((token) => token.length > 0);

      const correctTokens = sourceItems
        .map((item) => normalizeOrderToken(item))
        .filter((token) => token.length > 0);

      if (correctTokens.length === 0) {
        setResultMessage("整序候補が設定されていません。");
        return;
      }

      if (userTokens.length !== correctTokens.length) {
        setResultMessage("まだ違います。");
        return;
      }

      const isCorrect = userTokens.every(
        (token, index) => token === correctTokens[index]
      );

      setResultMessage(isCorrect ? "正解です。" : "まだ違います。");
    };

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold text-neutral-400">
          整序問題プレビュー
        </div>

        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] font-bold text-neutral-600 hover:bg-neutral-50"
        >
          シャッフルし直す
        </button>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <div className="whitespace-pre-wrap text-sm font-bold leading-6 text-neutral-900">
          {data.question || "正しい順に並べ替えてください。"}
        </div>

        <div className="mt-4">
          <div className="mb-1 text-[11px] font-bold text-neutral-500">
            候補
          </div>

          <div className="flex flex-wrap gap-2">
            {availableItems.length === 0 ? (
              <span className="text-xs text-neutral-400">
                候補はすべて選択済みです。
              </span>
            ) : (
              availableItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToAnswer(item)}
                  className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-sm font-bold text-neutral-700 hover:bg-neutral-100"
                >
                  {item.label}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 text-[11px] font-bold text-neutral-500">
            解答欄
          </div>

          <div className="min-h-[44px] rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-2">
            {answerItems.length === 0 ? (
              <span className="text-sm text-neutral-400">
                候補をクリックして並べます。
              </span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {answerItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => removeFromAnswer(item)}
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700 hover:bg-blue-100"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={checkAnswer}
            className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold text-white hover:bg-neutral-700"
          >
            答え合わせ
          </button>

          {resultMessage ? (
            <span className="text-xs font-bold text-neutral-700">
              {resultMessage}
            </span>
          ) : null}
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] font-bold text-neutral-400">
            正解確認
          </summary>
          <div className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            {data.answer || "未設定"}
          </div>
        </details>
      </div>
    </div>
  );
}

type OrderItem = {
  id: string;
  label: string;
};

function createOrderItems(labels: string[], answer: string): OrderItem[] {
  const items = labels.map((label, index) => ({
    id: `${index}-${label}-${Math.random().toString(36).slice(2)}`,
    label,
  }));

  return shuffleAvoidingNearCorrect(items, answer);
}

function shuffleAvoidingNearCorrect(
  items: OrderItem[],
  answer: string
): OrderItem[] {
  if (items.length <= 2) {
    return shuffleItems(items);
  }

  const correctLabels = tokenizeOrderAnswer(answer);

  if (correctLabels.length !== items.length) {
    return shuffleItems(items);
  }

  let best = shuffleItems(items);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidate = shuffleItems(items);
    const candidateLabels = candidate.map((item) => normalizeOrderToken(item.label));

    if (!isTooCloseToCorrect(candidateLabels, correctLabels)) {
      return candidate;
    }

    best = candidate;
  }

  return best;
}

function shuffleItems(items: OrderItem[]): OrderItem[] {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const current = nextItems[index];
    nextItems[index] = nextItems[randomIndex];
    nextItems[randomIndex] = current;
  }

  return nextItems;
}

function isTooCloseToCorrect(
  candidateLabels: string[],
  correctLabels: string[]
): boolean {
  if (candidateLabels.length !== correctLabels.length) {
    return false;
  }

  const exactSame = candidateLabels.every(
    (item, index) => item === correctLabels[index]
  );

  if (exactSame) {
    return true;
  }

  const samePositionCount = candidateLabels.filter(
    (item, index) => item === correctLabels[index]
  ).length;

  if (samePositionCount >= Math.ceil(correctLabels.length / 2)) {
    return true;
  }

  let sameAdjacentPairCount = 0;

  for (let index = 0; index < correctLabels.length - 1; index += 1) {
    const correctPair = `${correctLabels[index]} ${correctLabels[index + 1]}`;

    for (
      let candidateIndex = 0;
      candidateIndex < candidateLabels.length - 1;
      candidateIndex += 1
    ) {
      const candidatePair = `${candidateLabels[candidateIndex]} ${
        candidateLabels[candidateIndex + 1]
      }`;

      if (candidatePair === correctPair) {
        sameAdjacentPairCount += 1;
        break;
      }
    }
  }

  return sameAdjacentPairCount >= Math.ceil((correctLabels.length - 1) / 2);
}

function tokenizeOrderAnswer(value: string): string[] {
  return value
    .replace(/\r\n/g, "\n")
    .split(/\s+/)
    .map(normalizeOrderToken)
    .filter((token) => token.length > 0);
}

function normalizeOrderToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[“”"'「『（(\[]+/, "")
    .replace(/[“”"'」』）)\].,!?;:。！？、，]+$/, "");
}
