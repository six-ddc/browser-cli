/**
 * NetworkManager: Manages network request interception.
 *
 * Chrome (MV3): Uses declarativeNetRequest for blocking/redirecting,
 *   webRequest for observation only.
 * Firefox (MV2): Uses webRequest with blocking permission for both
 *   interception and observation. Blocking mode is only enabled when
 *   routes are active to avoid interfering with Firefox during
 *   extension reload.
 */

import type { NetworkRoute, NetworkRequest } from '@browser-cli/shared';

const IS_FIREFOX = import.meta.env.FIREFOX;
const RULE_ID_OFFSET = 10000; // Start rule IDs at 10000 to avoid conflicts

export class NetworkManager {
  private routes: Map<number, NetworkRoute> = new Map();
  private requests: NetworkRequest[] = [];
  private nextRouteId = 1;
  private requestListener:
    | ((
        details: Browser.webRequest.OnBeforeRequestDetails,
      ) => Browser.webRequest.BlockingResponse | undefined)
    | null = null;
  /** Whether the listener is currently in blocking mode (Firefox only) */
  private blockingMode = false;

  constructor() {
    this.initRequestTracking();
  }

  /**
   * Initialize request tracking using webRequest API.
   * Always starts in non-blocking (observation) mode.
   * Firefox switches to blocking when routes are added.
   */
  private initRequestTracking() {
    this.requestListener = (details) => {
      try {
        const request: NetworkRequest = {
          id: details.requestId,
          url: details.url,
          method: details.method,
          type: details.type,
          timestamp: details.timeStamp,
          tabId: details.tabId,
        };

        // Check if this request matches any block/redirect routes
        for (const route of this.routes.values()) {
          if (this.matchesPattern(details.url, route.pattern)) {
            if (route.action === 'block') {
              request.blocked = true;
              if (IS_FIREFOX) {
                this.requests.push(request);
                this.trimRequests();
                return { cancel: true };
              }
            } else if (route.redirectUrl) {
              // action === 'redirect'
              request.redirectedTo = route.redirectUrl;
              if (IS_FIREFOX) {
                this.requests.push(request);
                this.trimRequests();
                return { redirectUrl: route.redirectUrl };
              }
            }
          }
        }

        this.requests.push(request);
        this.trimRequests();
      } catch (err) {
        console.error('[browser-cli] NetworkManager request listener error:', err);
      }

      return undefined;
    };

    // Start in non-blocking mode — just observe requests
    browser.webRequest.onBeforeRequest.addListener(
      this.requestListener,
      { urls: ['<all_urls>'] },
      [],
    );
  }

  /**
   * Firefox: switch to blocking mode so the listener can cancel/redirect.
   * No-op on Chrome or if already in blocking mode.
   */
  private enableBlocking() {
    if (!IS_FIREFOX || this.blockingMode || !this.requestListener) return;
    browser.webRequest.onBeforeRequest.removeListener(this.requestListener);
    browser.webRequest.onBeforeRequest.addListener(this.requestListener, { urls: ['<all_urls>'] }, [
      'blocking',
    ]);
    this.blockingMode = true;
  }

  /**
   * Firefox: switch back to non-blocking (observation) mode.
   * No-op on Chrome or if already non-blocking.
   */
  private disableBlocking() {
    if (!IS_FIREFOX || !this.blockingMode || !this.requestListener) return;
    browser.webRequest.onBeforeRequest.removeListener(this.requestListener);
    browser.webRequest.onBeforeRequest.addListener(
      this.requestListener,
      { urls: ['<all_urls>'] },
      [],
    );
    this.blockingMode = false;
  }

  private trimRequests() {
    if (this.requests.length > 1000) {
      this.requests = this.requests.slice(-1000);
    }
  }

  /**
   * Add a new route (block or redirect).
   */
  async addRoute(
    pattern: string,
    action: 'block' | 'redirect',
    redirectUrl?: string,
  ): Promise<NetworkRoute> {
    const routeId = this.nextRouteId++;

    const route: NetworkRoute = {
      id: routeId,
      pattern,
      action,
      redirectUrl,
      createdAt: Date.now(),
    };

    if (!IS_FIREFOX) {
      // Chrome: add declarativeNetRequest rule
      const ruleId = RULE_ID_OFFSET + routeId;
      const urlFilter = this.convertPatternToUrlFilter(pattern);
      const rule: Browser.declarativeNetRequest.Rule = {
        id: ruleId,
        priority: 1,
        condition: {
          urlFilter,
          resourceTypes: [
            'main_frame',
            'sub_frame',
            'stylesheet',
            'script',
            'image',
            'font',
            'object',
            'xmlhttprequest',
            'ping',
            'csp_report',
            'media',
            'websocket',
            'other',
          ] as Browser.declarativeNetRequest.ResourceType[],
        },
        action:
          action === 'block'
            ? { type: 'block' as Browser.declarativeNetRequest.RuleActionType }
            : {
                type: 'redirect' as Browser.declarativeNetRequest.RuleActionType,
                redirect: { url: redirectUrl ?? '' },
              },
      };

      await browser.declarativeNetRequest.updateDynamicRules({
        addRules: [rule],
        removeRuleIds: [],
      });
    }

    // Firefox: enable blocking mode so the listener can intercept
    if (this.routes.size === 0) {
      this.enableBlocking();
    }

    this.routes.set(routeId, route);
    return route;
  }

  /**
   * Remove a route by ID.
   */
  async removeRoute(routeId: number): Promise<boolean> {
    const route = this.routes.get(routeId);
    if (!route) return false;

    if (!IS_FIREFOX) {
      // Chrome: remove declarativeNetRequest rule
      const ruleId = RULE_ID_OFFSET + routeId;
      await browser.declarativeNetRequest.updateDynamicRules({
        addRules: [],
        removeRuleIds: [ruleId],
      });
    }

    this.routes.delete(routeId);

    // Firefox: switch back to non-blocking when no routes remain
    if (this.routes.size === 0) {
      this.disableBlocking();
    }

    return true;
  }

  /**
   * Get all active routes.
   */
  getRoutes(): NetworkRoute[] {
    return Array.from(this.routes.values());
  }

  /**
   * Get tracked requests with optional filters.
   */
  getRequests(filters?: {
    pattern?: string;
    tabId?: number;
    blockedOnly?: boolean;
    limit?: number;
  }): { requests: NetworkRequest[]; total: number } {
    let filtered = [...this.requests];

    if (filters?.pattern) {
      const regex = this.patternToRegex(filters.pattern);
      filtered = filtered.filter((req) => regex.test(req.url));
    }

    if (filters?.tabId !== undefined) {
      filtered = filtered.filter((req) => req.tabId === filters.tabId);
    }

    if (filters?.blockedOnly) {
      filtered = filtered.filter((req) => req.blocked || req.redirectedTo);
    }

    const total = filtered.length;

    if (filters?.limit !== undefined && filters.limit > 0) {
      filtered = filtered.slice(-filters.limit);
    }

    return { requests: filtered, total };
  }

  /**
   * Clear all tracked requests.
   */
  clearRequests(): number {
    const count = this.requests.length;
    this.requests = [];
    return count;
  }

  /**
   * Convert a simple pattern (with wildcards) to URLFilter format.
   * @example "*.google.com" becomes "*google.com*"
   * @example "/api/..." becomes "*" + "/api/..."
   * @example "analytics" becomes "*analytics*"
   */
  private convertPatternToUrlFilter(pattern: string): string {
    // If pattern doesn't start with wildcard, add it
    if (!pattern.startsWith('*') && !pattern.startsWith('http')) {
      pattern = '*' + pattern;
    }
    // If pattern doesn't end with wildcard, add it
    if (!pattern.endsWith('*')) {
      pattern = pattern + '*';
    }
    return pattern;
  }

  /**
   * Check if a URL matches a pattern (for request tracking).
   */
  private matchesPattern(url: string, pattern: string): boolean {
    const regex = this.patternToRegex(pattern);
    return regex.test(url);
  }

  /**
   * Convert a wildcard pattern to a regex.
   */
  private patternToRegex(pattern: string): RegExp {
    // Escape special regex characters except *
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Replace * with .*
    const regex = escaped.replace(/\*/g, '.*');
    return new RegExp(regex, 'i');
  }

  /**
   * Cleanup on unload.
   */
  async destroy() {
    if (!IS_FIREFOX) {
      // Chrome: remove all dynamic rules
      const rules = await browser.declarativeNetRequest.getDynamicRules();
      const ruleIds = rules.map((r) => r.id);
      await browser.declarativeNetRequest.updateDynamicRules({
        addRules: [],
        removeRuleIds: ruleIds,
      });
    }

    // Remove request listener
    if (this.requestListener) {
      browser.webRequest.onBeforeRequest.removeListener(this.requestListener);
    }

    this.routes.clear();
    this.requests = [];
  }
}
