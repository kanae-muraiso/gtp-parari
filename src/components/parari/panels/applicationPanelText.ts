// apps/tools/parari/src/components/parari/panels/applicationPanelText.ts
// apps/tools/parari/src/components/parari/panels/applicationPanelText.ts
// 2026-03-31 JST

/**
 * PART: applicationPanelText
 * コメント:
 * - [APPLICATION] applicationId="abc123" の1行だけを SSOT に置く
 * - 定位置は IMAGE / YOUTUBE / INSTAGRAM / VIMEO の直下
 */

type ApplicationSettings = {
  enabled?: boolean;
  applicationId?: string;
};

function stripApplicationLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("[APPLICATION]"))
    .join("\n");
}

function insertApplicationIntoFirstPageAtFixedPosition(
  text: string,
  applicationLine: string
): string {
  const lines = text.split("\n");
  const out: string[] = [];

  let seenFirstPage = false;
  let inserted = false;
  let insideFirstPage = false;
  let pendingInsertIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!seenFirstPage && trimmed.startsWith("[PAGE]")) {
      seenFirstPage = true;
      insideFirstPage = true;
      out.push(line);
      continue;
    }

    if (insideFirstPage) {
      if (trimmed.startsWith("[PAGE]")) {
        if (!inserted) {
          out.push(applicationLine);
          inserted = true;
        }
        insideFirstPage = false;
        out.push(line);
        continue;
      }

      out.push(line);

      if (
        trimmed.startsWith("[IMAGE]") ||
        trimmed.startsWith("[YOUTUBE]") ||
        trimmed.startsWith("[INSTAGRAM]") ||
        trimmed.startsWith("[VIMEO]")
      ) {
        pendingInsertIndex = out.length;
        continue;
      }

      if (!inserted) {
        if (trimmed.startsWith("[LINK]")) {
          const insertAt =
            pendingInsertIndex >= 0 ? pendingInsertIndex : out.length - 1;
          out.splice(insertAt, 0, applicationLine);
          inserted = true;
          pendingInsertIndex = -1;
          continue;
        }

        if (trimmed !== "") {
          const insertAt =
            pendingInsertIndex >= 0 ? pendingInsertIndex : out.length - 1;
          out.splice(insertAt, 0, applicationLine);
          inserted = true;
          pendingInsertIndex = -1;
          continue;
        }
      }

      continue;
    }

    out.push(line);
  }

  if (!seenFirstPage) {
    return text.trimEnd() + `\n\n[PAGE]\n${applicationLine}\n`;
  }

  if (!inserted) {
    const insertAt = pendingInsertIndex >= 0 ? pendingInsertIndex : out.length;
    out.splice(insertAt, 0, applicationLine);
  }

  return out.join("\n");
}

export function upsertApplicationBlock(
  text: string,
  settings: ApplicationSettings
): string {
  const cleaned = stripApplicationLines(text);
  const enabled = Boolean(settings.enabled);
  const applicationId = String(settings.applicationId ?? "").trim();

  if (!enabled || !applicationId) {
    return cleaned;
  }

  const line = `[APPLICATION] applicationId="${applicationId}"`;
  return insertApplicationIntoFirstPageAtFixedPosition(cleaned, line);
}
