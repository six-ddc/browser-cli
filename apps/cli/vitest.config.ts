import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Supplied by the bun build's define; tests build the program the same way.
  define: { __APP_VERSION__: '"0.0.0-test"' },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/daemon/index.ts'],
    },
  },
});
