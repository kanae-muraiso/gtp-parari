import type {
  CarouselCardData,
  CarouselPanelData,
} from "./carouselTypes";

export function serializeCarouselPanel(
  data: CarouselPanelData,
): string {
  const cards = data.cards.map(serializeCard);

  if (cards.length === 0) {
    return "[CAROUSEL]\n[/CAROUSEL]";
  }

  return [
    "[CAROUSEL]",
    "",
    cards.join("\n\n"),
    "",
    "[/CAROUSEL]",
  ].join("\n");
}

function serializeCard(card: CarouselCardData): string {
  const body = String(card.bodySsot ?? "").trim();

  if (!body) {
    return "[CARD]\n[/CARD]";
  }

  return [
    "[CARD]",
    "",
    body,
    "",
    "[/CARD]",
  ].join("\n");
}
