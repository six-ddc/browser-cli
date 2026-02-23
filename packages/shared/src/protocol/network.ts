/**
 * Network interception types for request blocking, redirecting, and tracking.
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

export interface NetworkRequest {
  /** Request ID */
  id: string;
  /** Request URL */
  url: string;
  /** Request method */
  method: string;
  /** Request type (document, script, image, etc.) */
  type: string;
  /** Request timestamp */
  timestamp: number;
  /** Tab ID that initiated the request */
  tabId: number;
  /** Whether request was blocked */
  blocked?: boolean;
  /** Redirect URL if redirected */
  redirectedTo?: string;
}
