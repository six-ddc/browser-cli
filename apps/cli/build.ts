import { copyFileSync, rmSync } from 'node:fs';
import type { BunPlugin } from 'bun';
import pkg from './package.json';

// jsdom's XMLHttpRequest-impl.js calls require.resolve("./xhr-sync-worker.js") at
// module load time. Bun bundles this as an absolute path from the build machine,
// causing "Cannot find module" errors on other machines.
// This plugin neutralizes that call since sync XHR is not needed.
const patchJsdomXhr: BunPlugin = {
  name: 'patch-jsdom-xhr',
  setup(build) {
    build.onLoad({ filter: /XMLHttpRequest-impl\.js$/ }, async (args) => {
      let contents = await Bun.file(args.path).text();
      contents = contents.replace(
        /const syncWorkerFile = require\.resolve\s*\?\s*require\.resolve\(["']\.\/xhr-sync-worker\.js["']\)\s*:\s*null;/,
        'const syncWorkerFile = null;',
      );
      return { contents, loader: 'js' };
    });
  },
};

// Clean previous build output
rmSync('./dist', { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ['./src/index.ts', './src/daemon/index.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  sourcemap: 'linked',
  packages: 'bundle',
  plugins: [patchJsdomXhr],
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

// Copy root README for npm publish
copyFileSync('../../README.md', './README.md');

console.log(`Built ${result.outputs.length} files to dist/`);
