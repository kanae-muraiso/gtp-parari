// apps/tools/parari/src/components/parari/panels/instagram/parseInstagramPanel.ts
// 2026-06-23 JST - Instagram panel parser

export type InstagramPanelData = {
  url: string;
  title: string;
  caption: string;
  thumbnail: string;
  aspect: string;
  instagramWidth: string;
  extraLines: string[];
};

const KNOWN_CHILD_TAGS = new Set([
  "TITLE",
  "CAPTION",
  "THUMBNAIL",
  "ASPECT",
  "INSTAGRAM_WIDTH",
]);

export function parseInstagramPanel(raw: string): InstagramPanelData {
  const normalized = raw.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  const firstLine = lines[0] ?? "";
  const headerMatch = firstLine.match(/^\[INSTAGRAM\]\s*(.*)$/);

  const url = headerMatch?.[1]?.trim() ?? "";

  let title = "";
  let caption = "";
  let thumbnail = "";
  let aspect = "9:16";
  let instagramWidth = "100";
  const extraLines: string[] = [];

  let currentSection: "CAPTION" | null = null;
  const captionLines: string[] = [];

  for (const line of lines.slice(1)) {
    const childMatch = line.match(/^\[([A-Z_]+)\]\s*(.*)$/);

    if (childMatch) {
      const tag = childMatch[1];
      const value = childMatch[2] ?? "";

      if (KNOWN_CHILD_TAGS.has(tag)) {
        currentSection = null;

        switch (tag) {
          case "TITLE":
            title = value.trim();
            break;

          case "THUMBNAIL":
            thumbnail = value.trim();
            break;

          case "ASPECT":
            aspect = value.trim() || "9:16";
            break;

          case "INSTAGRAM_WIDTH":
            instagramWidth = value.trim() || "100";
            break;

          case "CAPTION":
            currentSection = "CAPTION";
            if (value.trim().length > 0) {
              captionLines.push(value);
            }
            break;
        }

        continue;
      }
    }

    if (currentSection === "CAPTION") {
      captionLines.push(line);
      continue;
    }

    if (line.trim().length > 0) {
      extraLines.push(line);
    }
  }

  caption = captionLines.join("\n").trim();

  return {
    url,
    title,
    caption,
    thumbnail,
    aspect,
    instagramWidth,
    extraLines,
  };
}
