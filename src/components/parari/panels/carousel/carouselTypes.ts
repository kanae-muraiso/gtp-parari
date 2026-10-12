export type CarouselCardData = {
  id: string;
  bodySsot: string;
  bodyBlocks?: import("@/lib/parari/readerProjectionTypes").PreparedReaderBlock[];
};

export type CarouselPanelData = {
  cards: CarouselCardData[];
};
