/**
 * Application name constant shared across packages.
 */
export const APP_NAME = 'Browser-CLI';

// Protocol types and schemas
export * from './protocol/index.js';

// Snapshot types
export * from './snapshot/index.js';

// Utilities
export { generateFriendlyId } from './util/friendly-id.js';
export { truncateUrl } from './util/url.js';
