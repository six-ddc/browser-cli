import { rmSync } from 'node:fs';
import pkg from './package.json';

// Clean previous build output
rmSync('./dist', { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ['./src/index.ts', './src/daemon/index.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  sourcemap: 'linked',
  packages: 'bundle',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});

if (!result.success) {
  console.error('Build failed:');
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`Built ${result.outputs.length} files to dist/`);
