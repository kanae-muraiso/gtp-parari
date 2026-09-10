// src/lib/parari/youtubeUrl.ts
// Shared YouTube URL parser for PARARI.
//
// Supported:
// - https://www.youtube.com/watch?v=VIDEO_ID
// - https://youtu.be/VIDEO_ID
// - https://www.youtube.com/embed/VIDEO_ID
// - https://www.youtube.com/shorts/VIDEO_ID
// - https://www.youtube.com/live/VIDEO_ID

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);

export function extractYoutubeVideoId(value: string): string {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();

    if (host === "youtu.be" || host === "www.youtu.be") {
      return url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    }

    if (!YOUTUBE_HOSTS.has(host)) {
      return "";
    }

    const pathPatterns = [
      /^\/shorts\/([^/]+)/,
      /^\/embed\/([^/]+)/,
      /^\/live\/([^/]+)/,
    ];

    for (const pattern of pathPatterns) {
      const match = url.pathname.match(pattern);

      if (match?.[1]) {
        return match[1];
      }
    }

    return url.searchParams.get("v") ?? "";
  } catch {
    return "";
  }
}

export function toYoutubeEmbedUrl(value: string): string | null {
  const videoId = extractYoutubeVideoId(value);

  return videoId
    ? `https://www.youtube.com/embed/${videoId}`
    : null;
}
