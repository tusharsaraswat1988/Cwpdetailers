export type PrecacheManifestEntry = string | { url: string; revision?: string | null };

/**
 * Workbox may only omit `revision` when the URL itself is content-hashed
 * (e.g. `index-abc123.js`). `/index.html` is not hashed, so an unrevisioned
 * entry is never invalidated after deploy and Workbox warns about it.
 *
 * Navigation documents are served by the NetworkFirst `pages` route in `sw.ts`.
 */
export function sanitizePrecacheManifest(
  entries: readonly PrecacheManifestEntry[],
): PrecacheManifestEntry[] {
  return entries.filter((entry) => {
    if (typeof entry === "string") return true;
    if (typeof entry.revision === "string" && entry.revision.length > 0) return true;
    return !isHtmlDocumentUrl(entry.url);
  });
}

function isHtmlDocumentUrl(url: string): boolean {
  const path = pathnameOf(url);
  return path === "/index.html" || path === "index.html" || path.endsWith("/index.html");
}

function pathnameOf(url: string): string {
  try {
    if (url.includes("://")) return new URL(url).pathname;
  } catch {
    /* fall through */
  }
  return url.split("?")[0] ?? url;
}
