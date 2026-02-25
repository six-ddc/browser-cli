import { parseArgs } from 'node:util';
import pkg from './package.json';

const { values } = parseArgs({
  options: {
    target: { type: 'string' },
    outfile: { type: 'string', default: './dist/browser-cli' },
  },
  strict: false,
});

const outfile = values.outfile ?? './dist/browser-cli';

const args = [
  'build',
  '--compile',
  './src/main.ts',
  '--outfile',
  outfile,
  '--minify',
  '--define',
  `__APP_VERSION__=${JSON.stringify(pkg.version)}`,
];

if (values.target) {
  args.push('--target', values.target);
}

const proc = Bun.spawnSync(['bun', ...args], {
  cwd: import.meta.dir,
  stdout: 'inherit',
  stderr: 'inherit',
});

if (proc.exitCode !== 0) {
  process.exit(proc.exitCode);
}

console.log(`Binary built to ${outfile}`);
