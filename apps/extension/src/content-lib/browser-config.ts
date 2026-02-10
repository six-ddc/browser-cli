/**
 * Browser config overrides via MAIN world script injection.
 * Handles: setGeo (geolocation override), setMedia (matchMedia override).
 */

import type { Command } from '@browser-cli/shared';

export async function handleBrowserConfig(command: Command): Promise<unknown> {
  switch (command.action) {
    case 'setGeo': {
      const { latitude, longitude, accuracy } = command.params as {
        latitude: number;
        longitude: number;
        accuracy?: number;
      };
      injectMainWorldScript(`
        (function() {
          const coords = {
            latitude: ${latitude},
            longitude: ${longitude},
            accuracy: ${accuracy ?? 100},
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          };
          navigator.geolocation.getCurrentPosition = function(success) {
            success({ coords, timestamp: Date.now() });
          };
          navigator.geolocation.watchPosition = function(success) {
            success({ coords, timestamp: Date.now() });
            return 0;
          };
        })();
      `);
      return { set: true };
    }

    case 'setMedia': {
      const { colorScheme } = command.params as { colorScheme: 'dark' | 'light' };
      injectMainWorldScript(`
        (function() {
          const original = window.matchMedia;
          window.matchMedia = function(query) {
            const result = original.call(window, query);
            if (query === '(prefers-color-scheme: dark)') {
              return Object.assign(Object.create(result), {
                matches: ${colorScheme === 'dark'},
                media: query,
              });
            }
            if (query === '(prefers-color-scheme: light)') {
              return Object.assign(Object.create(result), {
                matches: ${colorScheme === 'light'},
                media: query,
              });
            }
            return result;
          };
        })();
      `);
      return { set: true };
    }

    default:
      throw new Error(`Unknown browser config command: ${(command as { action: string }).action}`);
  }
}

function injectMainWorldScript(code: string): void {
  const script = document.createElement('script');
  script.textContent = code;
  document.documentElement.appendChild(script);
  script.remove();
}
