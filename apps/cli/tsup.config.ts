import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/daemon/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  noExternal: ['@browser-cli/shared'],
});
