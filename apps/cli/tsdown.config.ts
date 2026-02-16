import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/daemon/index.ts'],
  format: ['esm'],
  fixedExtension: false,
  dts: true,
  sourcemap: true,
  noExternal: ['@browser-cli/shared'],
  inlineOnly: false,
});
