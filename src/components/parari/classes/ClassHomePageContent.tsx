"use client";

import { ReaderBodyPanelRenderer } from "@/components/parari/reader/ReaderBodyPanelRenderer";
import { ViewerTextBlock } from "@/components/parari/viewer-v2/ViewerTextBlock";

/**
 * A CLASS business homepage renders the authored PAGE body directly inside its
 * business layout. We intentionally do not mount the book reader's toolbar,
 * progress controls or secondary reading navigation in a recruitment site.
 * CLASS's schedule/intake buttons are rendered separately and cannot be removed
 * by editing the PAGE SSOT.
 */
export default function ClassHomePageContent({ content }: { content: string }) {
  return <section className="min-w-0" aria-label="教室からのご案内">
    <ReaderBodyPanelRenderer
      bodySsot={content}
      renderTextBlock={({ text, tocHeadingStartIndex, tocHeadingIdPrefix }) => (
        <ViewerTextBlock text={text}
          headingStartIndex={tocHeadingStartIndex}
          headingIdPrefix={tocHeadingIdPrefix}
        />
      )}
    />
  </section>;
}
