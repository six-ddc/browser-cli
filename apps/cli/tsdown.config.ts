import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/daemon/index.ts'],
  format: ['esm'],
  fixedExtension: false,
  dts: true,
  sourcemap: true,
  noExternal: ['@browser-cli/shared'],
  inlineOnly: false,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
});
