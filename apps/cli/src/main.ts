/**
 * Unified entry point for compiled binary.
 * Routes to daemon or CLI based on --daemon flag.
 */
export {};

if (process.argv.includes('--daemon')) {
  await import('./daemon/index.js');
} else {
  await import('./index.js');
}
