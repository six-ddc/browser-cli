/**
 * Command execution overlay — content script side.
 *
 * Purely passive: only shows when background sends 'browser-cli-overlay-show'.
 * No init-time queries. Zero overhead for tabs not being automated.
 *
 * All styles live in adoptedStyleSheets to bypass strict CSP (e.g. Reddit).
 * No inline styles are set — only CSS classes are toggled.
 * Uses CSS animation for the fade-out (restartable via class re-add trick).
 */

const OVERLAY_DURATION_MS = 3000;

let host: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let sheet: CSSStyleSheet | null = null;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

function ensureHost(): void {
  if (host) return;

  host = document.createElement('browser-cli-overlay');
  shadow = host.attachShadow({ mode: 'closed' });

  sheet = new CSSStyleSheet();
  updateSheet(OVERLAY_DURATION_MS);
  shadow.adoptedStyleSheets = [sheet];

  const border = document.createElement('div');
  border.className = 'border';

  const badge = document.createElement('div');
  badge.className = 'badge';
  badge.textContent = 'Browser-CLI';

  shadow.append(border, badge);
  document.documentElement.appendChild(host);
}

function updateSheet(durationMs: number): void {
  sheet!.replaceSync(`
    @keyframes browser-cli-fade {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
    :host {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
      display: none;
    }
    :host(.visible) {
      display: block;
      animation: browser-cli-fade ${durationMs}ms linear forwards;
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
  `);
}

/**
 * Show overlay and start a fade-out over `durationMs`.
 * If called again while already visible, restarts the animation.
 */
export function showFor(durationMs: number): void {
  ensureHost();

  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }

  // Update animation duration if needed
  updateSheet(durationMs);

  // Restart animation: remove class, force reflow, re-add class
  host!.classList.remove('visible');
  void host!.offsetWidth;
  host!.classList.add('visible');

  hideTimeout = setTimeout(() => {
    hideTimeout = null;
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
