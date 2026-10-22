const { spawnSync } = require('node:child_process');
const { resolve, dirname } = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const { mkdirSync, writeFileSync } = require('node:fs');
const { stripVTControlCharacters } = require('node:util');
const root = resolve(__dirname, '../..');
const mode = process.argv[2] ?? 'compiled';
const preload = resolve(__dirname, 'environment.cjs');
const vitest = resolve(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
let args;
if (mode === 'compiled') args = ['--test', '--test-timeout=60000', resolve(__dirname, 'compiled.test.cjs')];
else if (mode === 'vitest') args = ['--require', preload, vitest, 'run', '--config', 'test/diagnostics/vitest.config.mts'];
else if (mode === 'regression') args = ['--require', preload, vitest, 'run', '--config', 'vitest.config.ts'];
else if (mode === 'e2e') args = ['--require', preload, vitest, 'run', '--config', 'vitest.config.e2e.ts', '--hookTimeout', '35000'];
else if (mode === 'tsx') {
  if (!process.argv[3]) throw new Error('Pass the absolute path to the cached @vercel/node/package.json');
  const cached = createRequire(resolve(process.argv[3]));
  console.log('Cached @vercel/node:', cached('./package.json').version);
  args = ['--require', preload, '--import', pathToFileURL(cached.resolve('tsx')).href, resolve(__dirname, 'source-probe.cjs')];
} else if (mode === 'vercel' || mode === 'compiler') {
  if (!process.argv[3]) throw new Error('Pass the absolute path to the cached @vercel/node/package.json');
  args = [resolve(__dirname, mode === 'vercel' ? 'vercel-runtime.cjs' : 'compiler-probe.cjs'), resolve(process.argv[3])];
} else throw new Error(`Unknown diagnostic mode: ${mode}`);
// Do not inherit deployment credentials or loader flags. Preserve OS execution paths only.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|USERPROFILE|HOME|LOCALAPPDATA|APPDATA)$/i.test(key)));
const result = spawnSync(process.execPath, args, { cwd: root, env, timeout: 90000, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
if (result.error) console.error(result.error.message);
const results = resolve(__dirname, 'results');
mkdirSync(results, { recursive: true });
writeFileSync(resolve(results, `${mode}.log`), stripVTControlCharacters(
  `Node ${process.version}; mode=${mode}; exit=${result.status}; error=${result.error?.message ?? 'none'}\n`
  + (result.stdout ?? '') + (result.stderr ?? '')));
process.exitCode = result.status ?? 1;
