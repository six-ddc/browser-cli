/**
 * Network interception types for request blocking and redirecting.
 * Uses chrome.declarativeNetRequest API (MV3).
 */

export interface NetworkRoute {
  /** Unique ID for this route */
  id: number;
  /** URL pattern to match (supports wildcards) */
  pattern: string;
  /** Action type */
  action: 'block' | 'redirect';
  /** Redirect URL (only for redirect action) */
  redirectUrl?: string;
  /** When this route was created */
  createdAt: number;
}
