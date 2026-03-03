/**
 * Wait for DOM to quiesce — but only if mutations are actively happening.
 *
 * Strategy:
 * 1. Observe for a short detection window (50ms).
 * 2. If zero mutations → DOM is already stable, resolve immediately (no penalty).
 * 3. If mutations detected → switch to debounce mode: wait until mutations stop
 *    for `debounce` ms, with a hard `timeout` cap.
 */

/** How long to watch before concluding "nothing is changing" (ms). */
const DETECT_WINDOW_MS = 50;
/** After detecting activity, wait for this long of silence before resolving (ms). */
const STABLE_DEBOUNCE_MS = 150;
/** Absolute maximum wait time once activity is detected (ms). */
const STABLE_TIMEOUT_MS = 3000;

export function waitForDOMStable(
  detectWindow = DETECT_WINDOW_MS,
  debounce = STABLE_DEBOUNCE_MS,
  timeout = STABLE_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve) => {
    let mutationSeen = false;

    const obs = new MutationObserver(() => {
      mutationSeen = true;
    });
    obs.observe(document.body, { subtree: true, childList: true, attributes: true });

    // Phase 1: detect window — check if anything is changing
    setTimeout(() => {
      if (!mutationSeen) {
        // DOM is already stable, no penalty
        obs.disconnect();
        resolve();
        return;
      }

      // Phase 2: mutations detected — debounce until quiescent
      let debounceTimer = setTimeout(done, debounce);

      // Replace observer callback to reset debounce on each mutation
      obs.disconnect();
      const debounceObs = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(done, debounce);
      });
      debounceObs.observe(document.body, { subtree: true, childList: true, attributes: true });

      // Hard timeout — don't wait forever for busy pages (live tickers, etc.)
      const hardTimer = setTimeout(done, timeout);

      function done() {
        clearTimeout(debounceTimer);
        clearTimeout(hardTimer);
        debounceObs.disconnect();
        resolve();
      }
    }, detectWindow);
  });
}
