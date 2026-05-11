/**
 * SHA-256 hash of a CSV (or any string), returned as lowercase hex.
 *
 * Used to key the localStorage cache by file content — re-uploading the
 * same Flighty CSV returns the previously computed result instantly.
 *
 * Works in browser (Web Crypto API) and Node 18+ (built-in `crypto.subtle`).
 */
export async function hashCsv(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
