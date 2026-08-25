"use client";

import type { PanelRendererProps } from "../panelDefinitionTypes";
import type { CarouselPanelData } from "./carouselTypes";

export function CarouselPanelRenderer({
  data,
  renderNestedPanelViewer,
}: PanelRendererProps<CarouselPanelData>) {
  if (data.cards.length === 0) {
    return null;
  }

  return (
    <div className="w-full overflow-hidden">
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
        {data.cards.map((card) => (
          <article
            key={card.id}
            className="w-[82vw] max-w-[320px] shrink-0 snap-start overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:w-[320px]"
          >
            {renderNestedPanelViewer ? (
              renderNestedPanelViewer(card.bodySsot)
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-7 text-neutral-700">
                {card.bodySsot}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
