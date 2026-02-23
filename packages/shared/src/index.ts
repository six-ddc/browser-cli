/**
 * Returns a formatted greeting message.
 */
export function greet(name: string): string {
  return `Hello, ${name}! Welcome to Browser-CLI.`;
}

/**
 * Application name constant shared across packages.
 */
export const APP_NAME = 'Browser-CLI';

/**
 * Application version constant shared across packages.
 */
export const APP_VERSION = '0.1.0';

// Protocol types and schemas
export * from './protocol/index.js';

// Snapshot types
export * from './snapshot/index.js';

// Utilities
export { generateFriendlyId } from './util/friendly-id.js';
export { truncateUrl } from './util/url.js';
