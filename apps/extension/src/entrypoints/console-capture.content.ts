import { installConsoleCapture } from '../content-lib/console-patch';

// NOTE: the filename determines the IIFE global WXT emits for this MAIN-world
// script (`var <entrypointName> = (function(){…})()`), and that `var` lands on
// the page's own global object. Naming this file `console.content.ts` emits
// `var console = …`, which destroys `window.console` on every page and breaks
// capture entirely. Any rename must stay clear of real globals.

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  world: 'MAIN',
  runAt: 'document_start',
  // Firefox MV2 content_scripts don't support the `world` key at all — WXT
  // does not strip it automatically, so exclude the entrypoint entirely.
  // Firefox falls back to the eval-based injection in
  // console-capture.ts's ensurePatched().
  exclude: ['firefox'],
  main() {
    installConsoleCapture();
  },
});
