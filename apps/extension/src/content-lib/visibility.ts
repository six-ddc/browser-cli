/**
 * Single visibility implementation shared by queries, waits and actionability
 * checks, so `is visible`, `wait <sel>` and `click <sel>` never disagree.
 *
 * Snapshots use `isVisibleForSnapshot` in snapshot-helpers.ts instead — it
 * answers a different question and the two must not be merged.
 */

let layoutEngine: boolean | undefined;

/**
 * Whether the environment computes layout. jsdom (unit tests) reports every
 * element as 0x0 and has no hit-testing, so size and occlusion checks are
 * skipped there instead of failing every interaction.
 */
export function hasLayoutEngine(): boolean {
  if (layoutEngine === undefined) {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:10px;height:10px;';
    document.documentElement.appendChild(probe);
    layoutEngine = probe.getBoundingClientRect().height > 0;
    probe.remove();
  }
  return layoutEngine;
}

export function isElementVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  if (style.opacity === '0') return false;

  if (hasLayoutEngine()) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
  } else if (!el.isConnected) {
    return false;
  }

  return true;
}
