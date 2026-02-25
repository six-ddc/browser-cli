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

const result = await Bun.build({
  entrypoints: ['./src/main.ts'],
  outdir: '.',
  minify: true,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  target: (values.target as 'bun') ?? 'bun',
  compile: {
    outfile,
  },
  plugins: [patchJsdomXhr],
});

if (!result.success) {
  for (const msg of result.logs) console.error(msg);
  process.exit(1);
}

console.log(`Binary built to ${outfile}`);
