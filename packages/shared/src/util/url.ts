/**
 * URL truncation utilities for reducing noise in agent context.
 */

const ELLIPSIS = '\u2026';

/**
 * Truncate a URL to reduce noise in agent context.
 *
 * - If the query string (including `?`) exceeds `maxQueryLength` chars, replaces it with `?…`
 *   (preserving any hash fragment). The result is intentionally not a valid URL.
 * - If the total URL still exceeds `maxLength`, truncates with `…`.
 *
 * Works with both absolute and relative URLs.
 */
export function truncateUrl(
  url: string,
  options: {
    /** Max query string length (including `?`). Default: 50. */
    maxQueryLength?: number;
    /** Max total URL length. Default: no limit. */
    maxLength?: number;
  } = {},
): string {
  const { maxQueryLength = 50, maxLength = Infinity } = options;

  let result = url;

  // Truncate query string if too long — keep the first maxQueryLength chars
  const qIdx = result.indexOf('?');
  if (qIdx !== -1) {
    const hashIdx = result.indexOf('#', qIdx);
    const queryStr = hashIdx !== -1 ? result.slice(qIdx, hashIdx) : result.slice(qIdx);
    if (queryStr.length > maxQueryLength) {
      const kept = queryStr.slice(0, maxQueryLength);
      const hash = hashIdx !== -1 ? result.slice(hashIdx) : '';
      result = `${result.slice(0, qIdx)}${kept}${ELLIPSIS}${hash}`;
    }
  }

  // Truncate total length if still too long
  if (result.length > maxLength) {
    result = result.slice(0, maxLength) + ELLIPSIS;
  }

  return result;
}
