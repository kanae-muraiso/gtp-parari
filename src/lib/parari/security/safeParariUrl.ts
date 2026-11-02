/**
 * URLs from author content are data, not executable instructions.
 * Only explicitly permitted schemes can become clickable links or image sources.
 */
export function safeParariUrl(
  input: string,
  kind: "link" | "image" = "link",
): string | null {
  const raw = String(input ?? "").trim();
  if (!raw || /[\u0000-\u001f\u007f\\]/.test(raw)) return null;
  if (raw.startsWith("//")) return null;
  if (raw.startsWith("/")) return raw;
  if (kind === "link" && raw.startsWith("#")) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") {
      if (!url.hostname || url.username || url.password) return null;
      return url.href;
    }
    if (kind === "link" && url.protocol === "mailto:" && url.pathname) {
      return url.href;
    }
  } catch {
    // Unsupported or malformed links remain plain text.
  }
  return null;
}
