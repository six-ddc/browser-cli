/**
 * Command execution overlay — content script side.
 *
 * Purely passive: only shows when background sends 'browser-cli-overlay-show'.
 * No init-time queries. Zero overhead for tabs not being automated.
 *
 * Uses a 3s linear fade-out via CSS transition. Re-activation snaps back to
 * full opacity and restarts the fade. No @keyframes — maximum compatibility.
 */

const OVERLAY_DURATION_MS = 3000;

let host: HTMLElement | null = null;
let visible = false;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

function ensureHost(): void {
  if (host) return;

  host = document.createElement('browser-cli-overlay');
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    :host {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
      display: none;
    }
    :host(.visible) {
      display: block;
    }
    .border {
      position: absolute;
      inset: 0;
      border: 4px solid #f97316;
      border-radius: 4px;
    }
    .badge {
      position: absolute;
      top: 8px;
      right: 8px;
      background: #f97316;
      color: #fff;
      font: 700 12px/1 system-ui, sans-serif;
      padding: 5px 10px;
      border-radius: 4px;
      letter-spacing: 0.03em;
    }
  `;

  const border = document.createElement('div');
  border.className = 'border';

  const badge = document.createElement('div');
  badge.className = 'badge';
  badge.textContent = 'Browser-CLI';

  shadow.append(style, border, badge);
  document.documentElement.appendChild(host);
}

/**
 * Show overlay and start a linear fade-out over `durationMs`.
 * If called again while already visible, snaps back to full opacity
 * and restarts the fade from scratch.
 */
export function showFor(durationMs: number): void {
  ensureHost();

  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  // Snap to full opacity (no transition) then start fade
  host!.style.transition = 'none';
  host!.style.opacity = '1';
  host!.classList.add('visible');
  // Force reflow so the snap takes effect before we set the transition
  void host!.offsetWidth;

  // Start linear fade-out over the full duration
  host!.style.transition = `opacity ${durationMs}ms linear`;
  host!.style.opacity = '0';
  visible = true;

  // Remove from layout after fade completes
  hideTimeout = setTimeout(() => {
    hideTimeout = null;
    visible = false;
    host?.classList.remove('visible');
  }, durationMs);
}

/** Register listener for overlay messages from background. Only top frame. */
export function initOverlay(): void {
  if (window !== window.top) return;

  browser.runtime.onMessage.addListener(
    (message: { type?: string; remainingMs?: number }, _sender, sendResponse) => {
      if (message.type === 'browser-cli-overlay-show') {
        showFor(message.remainingMs ?? OVERLAY_DURATION_MS);
        (sendResponse as (r: unknown) => void)({ success: true });
        return true;
      }
      return false;
    },
  );
}
