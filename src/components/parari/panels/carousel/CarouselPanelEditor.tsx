"use client";

import type { PanelEditorProps } from "../panelDefinitionTypes";
import type {
  CarouselCardData,
  CarouselPanelData,
} from "./carouselTypes";
import { serializeCarouselPanel } from "./serializeCarouselPanel";

export function CarouselPanelEditor({
  data,
  onChangeRaw,
  renderNestedPanelEditor,
}: PanelEditorProps<CarouselPanelData>) {
  const commit = (cards: CarouselCardData[]) => {
    const normalizedCards = cards.map((card, index) => ({
      ...card,
      id: `card-${index + 1}`,
    }));

    onChangeRaw?.(
      serializeCarouselPanel({
        cards: normalizedCards,
      }),
    );
  };

  const updateCard = (
    cardIndex: number,
    bodySsot: string,
  ) => {
    commit(
      data.cards.map((card, index) =>
        index === cardIndex
          ? {
              ...card,
              bodySsot,
            }
          : card,
      ),
    );
  };

  const addCard = () => {
    commit([
      ...data.cards,
      {
        id: `card-${data.cards.length + 1}`,
        bodySsot: "[T]\nカードの内容を書いてください。",
      },
    ]);
  };

  const deleteCard = (cardIndex: number) => {
    const ok = window.confirm(
      "このCARDを削除します。よろしいですか？",
    );

    if (!ok) {
      return;
    }

    commit(
      data.cards.filter((_, index) => index !== cardIndex),
    );
  };

  const moveCard = (
    cardIndex: number,
    direction: -1 | 1,
  ) => {
    const nextIndex = cardIndex + direction;

    if (
      nextIndex < 0 ||
      nextIndex >= data.cards.length
    ) {
      return;
    }

    const nextCards = [...data.cards];
    const current = nextCards[cardIndex];

    nextCards[cardIndex] = nextCards[nextIndex];
    nextCards[nextIndex] = current;

    commit(nextCards);
  };

  return (
    <div className="space-y-3">
      {data.cards.map((card, index) => (
        <section
          key={card.id}
          className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-3"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-xs font-bold text-neutral-500">
              CARD {index + 1}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => moveCard(index, -1)}
                disabled={index === 0}
                className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500 disabled:opacity-30"
                title="左へ移動"
              >
                ←
              </button>

              <button
                type="button"
                onClick={() => moveCard(index, 1)}
                disabled={index === data.cards.length - 1}
                className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500 disabled:opacity-30"
                title="右へ移動"
              >
                →
              </button>

              <button
                type="button"
                onClick={() => deleteCard(index)}
                className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-400 hover:text-rose-600"
              >
                削除
              </button>
            </div>
          </div>

          {renderNestedPanelEditor ? (
            renderNestedPanelEditor({
              value: card.bodySsot,
              onChange: (nextValue) =>
                updateCard(index, nextValue),
            })
          ) : (
            <textarea
              value={card.bodySsot}
              onChange={(event) =>
                updateCard(index, event.target.value)
              }
              className="min-h-40 w-full rounded-xl border border-neutral-200 bg-white p-3 font-mono text-xs leading-6"
            />
          )}
        </section>
      ))}

      <button
        type="button"
        onClick={addCard}
        className="w-full rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm font-bold text-neutral-500 hover:bg-neutral-50"
      >
        ＋ CARDを追加
      </button>
    </div>
  );
}
