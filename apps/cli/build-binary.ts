import { parseArgs } from 'node:util';
import type { BunPlugin } from 'bun';
import pkg from './package.json';

const { values } = parseArgs({
  options: {
    target: { type: 'string' },
    outfile: { type: 'string', default: './dist/browser-cli' },
  },
  strict: false,
});

const outfile = values.outfile ?? './dist/browser-cli';

// jsdom's XMLHttpRequest-impl.js calls require.resolve("./xhr-sync-worker.js") at
// module load time. bun --compile bakes this into an absolute path from the build
// machine, causing "Cannot find module" errors on other machines.
// This plugin intercepts the file at bundle time and neutralizes that call.
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

// First, bundle to a temporary file with the plugin applied
const bundleResult = await Bun.build({
  entrypoints: ['./src/main.ts'],
  outdir: './dist/.tmp',
  minify: true,
  target: 'bun',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [patchJsdomXhr],
});

if (!bundleResult.success) {
  for (const msg of bundleResult.logs) console.error(msg);
  process.exit(1);
}

// Then, compile the bundled JS into a binary via CLI
const args = ['build', '--compile', './dist/.tmp/main.js', '--outfile', outfile, '--minify'];

if (values.target) {
  args.push('--target', values.target);
}

const proc = Bun.spawnSync(['bun', ...args], {
  cwd: import.meta.dir,
  stdout: 'inherit',
  stderr: 'inherit',
});

// Clean up temp bundle
const { rmSync } = await import('node:fs');
rmSync('./dist/.tmp', { recursive: true, force: true });

if (proc.exitCode !== 0) {
  process.exit(proc.exitCode);
}

console.log(`Binary built to ${outfile}`);
