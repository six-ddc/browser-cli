import path from 'node:path';
import os from 'node:os';

// Page paths (relative to base URL served from test/e2e-pw/pages/)
// Note: `serve` strips .html extensions (301 redirect), so use extensionless paths
export const PAGES = {
  HOME: 'home',
  LOGIN: 'login',
  SECURE: 'secure',
  CHECKBOXES: 'checkboxes',
  DROPDOWN: 'dropdown',
  INPUTS: 'inputs',
  UPLOAD: 'upload',
  DRAG_AND_DROP: 'drag-and-drop',
  HOVERS: 'hovers',
  KEY_PRESSES: 'key-presses',
  CONTEXT_MENU: 'context-menu',
  ADD_REMOVE: 'add-remove',
  DYNAMIC_CONTENT: 'dynamic-content',
  DYNAMIC_CONTROLS: 'dynamic-controls',
  DYNAMIC_LOADING_1: 'dynamic-loading-1',
  DYNAMIC_LOADING_2: 'dynamic-loading-2',
  IFRAME: 'iframe',
  NESTED_FRAMES: 'nested-frames',
  JAVASCRIPT_ALERTS: 'javascript-alerts',
  JAVASCRIPT_ERROR: 'javascript-error',
  LARGE_PAGE: 'large-page',
  FORGOT_PASSWORD: 'forgot-password',
  SHADOW_DOM: 'shadow-dom',
  TABLES: 'tables',
  WINDOWS: 'windows',
  HORIZONTAL_SLIDER: 'horizontal-slider',
  INFINITE_SCROLL: 'infinite-scroll',
  BROKEN_IMAGES: 'broken-images',
  ERROR_TEST: 'error-test',
  TESTID_PAGE: 'testid-page',
} as const;

// Test credentials for login page
export const TEST_USERNAME = 'tomsmith';
export const TEST_PASSWORD = 'SuperSecretPassword!';

// Common selectors reused across tests
export const SEL = {
  CHECKBOX: 'input[type="checkbox"]',
  DROPDOWN: 'select#dropdown',
  USERNAME: '#username',
  PASSWORD: '#password',
  LOGIN_BTN: 'button[type="submit"]',
  FLASH_MESSAGE: '#flash',
  FILE_UPLOAD: '#file-upload',
  FILE_SUBMIT: '#file-submit',
  DRAG_COL_A: '#column-a',
  DRAG_COL_B: '#column-b',
} as const;

// E2E daemon uses a separate WS port to avoid conflicts with a user's daemon
export const E2E_WS_PORT = 19222;

// Isolated directory for E2E daemon files (socket, pid) — avoids touching ~/.browser-cli/
export const E2E_DIR = path.join(os.tmpdir(), 'browser-cli-e2e');

// Timeouts (ms)
export const TIMEOUTS = {
  NAV: 10_000,
  CMD: 10_000,
  PAGE_LOAD: 2_000,
} as const;
