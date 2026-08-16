/**
 * Resolving a shipped asset path against the deployment root.
 *
 * ESAT Atlas is published to a repository sub-path on GitHub Pages, so nothing may use an
 * absolute `/questions/...` URL. `static/index.html` records the base the build was made
 * with, and everything that names a file — an image, the question bank, the service worker
 * — goes through here so there is exactly one place that knows how paths are formed.
 */

let cachedAssetBase: string | null = null;

/** The deployment root, always with a trailing slash. */
export function assetBase(): string {
  if (cachedAssetBase === null) {
    const configured = typeof document === "undefined"
      ? "/"
      : document.querySelector<HTMLMetaElement>('meta[name="esat-asset-base"]')?.content ?? "/";
    cachedAssetBase = configured.endsWith("/") ? configured : `${configured}/`;
  }
  return cachedAssetBase;
}

/** An absolute URL or a data URI is already resolved and is returned untouched. */
export function publicAsset(path: string): string {
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  return `${assetBase()}${path.replace(/^\/+/, "")}`;
}
