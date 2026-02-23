/**
 * Scroll operations: scroll, scrollIntoView.
 */

import type { Command } from '@browser-cli/shared';
import { resolveElement } from './element-ref-store';

const DEFAULT_SCROLL_AMOUNT = 400;

// eslint-disable-next-line @typescript-eslint/require-await -- async for caller contract
export async function handleScroll(command: Command): Promise<unknown> {
  switch (command.action) {
    case 'scroll': {
      const { direction, amount, selector } = command.params;
      const px = amount ?? DEFAULT_SCROLL_AMOUNT;

      const target = selector ? resolveElement(selector) : null;
      const scrollTarget = target || document.documentElement;

      const scrollOptions: ScrollToOptions = { behavior: 'smooth' };

      switch (direction) {
        case 'up':
          scrollTarget.scrollBy({ ...scrollOptions, top: -px });
          break;
        case 'down':
          scrollTarget.scrollBy({ ...scrollOptions, top: px });
          break;
        case 'left':
          scrollTarget.scrollBy({ ...scrollOptions, left: -px });
          break;
        case 'right':
          scrollTarget.scrollBy({ ...scrollOptions, left: px });
          break;
      }

      return { scrolled: true };
    }
    case 'scrollIntoView': {
      const { selector } = command.params;
      const el = resolveElement(selector);
      if (!el) throw new Error(`Element not found: ${selector}`);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return { scrolled: true };
    }
    default:
      throw new Error(`Unknown scroll command: ${(command as { action: string }).action}`);
  }
}
