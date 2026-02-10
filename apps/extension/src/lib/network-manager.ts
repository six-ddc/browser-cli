/**
 * NetworkManager: Manages network request interception using browser.declarativeNetRequest.
 * Provides blocking, redirecting, and request tracking capabilities.
 */

import type { NetworkRoute, NetworkRequest } from '@browser-cli/shared';

const RULE_ID_OFFSET = 10000; // Start rule IDs at 10000 to avoid conflicts

export class NetworkManager {
  private routes: Map<number, NetworkRoute> = new Map();
  private requests: NetworkRequest[] = [];
  private nextRouteId = 1;
  private requestListener: ((details: Browser.webRequest.OnBeforeRequestDetails) => Browser.webRequest.BlockingResponse | undefined) | null = null;

  constructor() {
    this.initRequestTracking();
  }

  /**
   * Initialize request tracking using webRequest API.
   * Note: We can't modify requests in MV3, only track them.
   */
  private initRequestTracking() {
    // Track all requests
    this.requestListener = (details) => {
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
          } else if (route.action === 'redirect' && route.redirectUrl) {
            request.redirectedTo = route.redirectUrl;
          }
        }
      }

      this.requests.push(request);

      // Keep only last 1000 requests to avoid memory issues
      if (this.requests.length > 1000) {
        this.requests = this.requests.slice(-1000);
      }

      return undefined; // We're only tracking, not blocking
    };

    browser.webRequest.onBeforeRequest.addListener(
      this.requestListener,
      { urls: ['<all_urls>'] },
      []
    );
  }

  /**
   * Add a new route (block or redirect).
   */
  async addRoute(pattern: string, action: 'block' | 'redirect', redirectUrl?: string): Promise<NetworkRoute> {
    const routeId = this.nextRouteId++;
    const ruleId = RULE_ID_OFFSET + routeId;

    const route: NetworkRoute = {
      id: routeId,
      pattern,
      action,
      redirectUrl,
      createdAt: Date.now(),
    };

    // Convert pattern to URLFilter format
    const urlFilter = this.convertPatternToUrlFilter(pattern);

    // Build the declarativeNetRequest rule
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
              redirect: { url: redirectUrl! },
            },
    };

    // Add the rule
    await browser.declarativeNetRequest.updateDynamicRules({
      addRules: [rule],
      removeRuleIds: [],
    });

    this.routes.set(routeId, route);
    return route;
  }

  /**
   * Remove a route by ID.
   */
  async removeRoute(routeId: number): Promise<boolean> {
    const route = this.routes.get(routeId);
    if (!route) return false;

    const ruleId = RULE_ID_OFFSET + routeId;

    await browser.declarativeNetRequest.updateDynamicRules({
      addRules: [],
      removeRuleIds: [ruleId],
    });

    this.routes.delete(routeId);
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
    // Remove all dynamic rules
    const rules = await browser.declarativeNetRequest.getDynamicRules();
    const ruleIds = rules.map((r) => r.id);
    await browser.declarativeNetRequest.updateDynamicRules({
      addRules: [],
      removeRuleIds: ruleIds,
    });

    // Remove request listener
    if (this.requestListener) {
      browser.webRequest.onBeforeRequest.removeListener(this.requestListener);
    }

    this.routes.clear();
    this.requests = [];
  }
}
