const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { stripVTControlCharacters } = require('node:util');

const root = path.resolve(__dirname, '../..');
const variant = process.argv[2];
const cli = path.resolve(process.argv[3] ?? '');
const runId = process.argv[4];
const traceCompiler = process.argv[5] === '--trace-compiler';
const timeoutMs = traceCompiler ? 3600000 : 900000;
if (!['A', 'B'].includes(variant) || !fs.existsSync(cli) || !/^[a-zA-Z0-9-]+$/.test(runId ?? '')) {
  throw new Error('Usage: node test/diagnostics/ab-build.cjs A|B <absolute-vercel-vc.js> <run-id>');
}
const resultDir = path.join(__dirname, 'results', runId, variant);
if (fs.existsSync(resultDir)) throw new Error('Refusing to overwrite a previous A/B result');
fs.mkdirSync(resultDir, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), `bibliolink-vercel-${variant}-`));
const hash = (data) => createHash('sha256').update(data).digest('hex');
const inputs = [];
function copyInput(relative) {
  const source = path.join(root, relative);
  if (fs.statSync(source).isDirectory()) {
    for (const name of fs.readdirSync(source)) copyInput(path.join(relative, name));
  } else {
    const bytes = fs.readFileSync(source);
    const target = path.join(work, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    inputs.push({ path: relative.replaceAll('\\', '/'), sha256: hash(bytes) });
  }
}
// Explicit allowlist: never copy .env, user config, git metadata or Vercel credentials.
for (const file of ['src', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
  'tsconfig.json', 'tsconfig.build.json', 'nest-cli.json']) copyInput(file);
fs.mkdirSync(path.join(work, '.vercel'));
const settings = {
  projectId: 'prj_bibliolink_diagnostic_offline', orgId: 'team_diagnostic_offline',
  projectName: 'bibliolink-diagnostic-offline',
  settings: { framework: 'nestjs', buildCommand: 'pnpm run build', installCommand: '',
    outputDirectory: null, rootDirectory: null, nodeVersion: '24.x', directoryListing: false },
};
fs.writeFileSync(path.join(work, '.vercel/project.json'), JSON.stringify(settings, null, 2));
const temporaryConfig = path.join(work, 'vercel.json');
if (variant === 'B') fs.writeFileSync(temporaryConfig, '{ "outputDirectory": "dist" }\n');
fs.writeFileSync(path.join(resultDir, 'inputs.json'), JSON.stringify({ variant, inputs, localSettings: settings.settings,
  vercelConfig: variant === 'B' ? { outputDirectory: 'dist' } : null }, null, 2));
const globalConfig = path.join(work, 'isolated-cli-config');
fs.mkdirSync(globalConfig);
const emptyNpmConfig = path.join(work, 'empty-npmrc');
fs.writeFileSync(emptyNpmConfig, '');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|USERPROFILE|HOME|LOCALAPPDATA|APPDATA)$/i.test(key)));
Object.assign(env, {
  CI: '1', VERCEL_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1', NO_COLOR: '1',
  NPM_CONFIG_USERCONFIG: emptyNpmConfig, NPM_CONFIG_UPDATE_NOTIFIER: 'false',
  npm_config_node_experimental_package_map: 'false',
  npm_config_enable_global_virtual_store: 'false',
  pnpm_config_verify_deps_before_run: 'false',
  DIAGNOSTIC_BUILD_TRACE: traceCompiler ? '1' : '0',
  NODE_OPTIONS: `--require "${path.join(__dirname, 'build-offline.cjs').replaceAll('\\', '/')}"`,
});
// Independent installation: never junction a shared node_modules into the workspace.
// Cached packages only; no lifecycle scripts or dependency resolution changes.
const pnpm = path.join(process.env.APPDATA, 'npm/node_modules/pnpm/bin/pnpm.mjs');
console.log(`[AB ${variant}] preparing independent offline dependencies`);
const install = spawnSync(process.execPath, [pnpm, 'install', '--offline', '--frozen-lockfile',
  '--ignore-scripts', '--config.node-experimental-package-map=false',
  '--config.enable-global-virtual-store=false'], {
  cwd: work, env, encoding: 'utf8', windowsHide: true, timeout: 180000,
});
fs.writeFileSync(path.join(resultDir, 'install.log'), stripVTControlCharacters(`${install.stdout ?? ''}${install.stderr ?? ''}`));
if (install.error || install.status !== 0) {
  throw new Error(`Independent offline installation failed: ${install.error?.message ?? install.status}; see install.log`);
}
const args = [cli, 'build', '--target', 'preview', '--global-config', globalConfig];
console.log(`[AB ${variant}] isolated build started; no remote project or environment fetched`);
const started = Date.now();
fs.writeFileSync(path.join(resultDir, 'started.json'), JSON.stringify({ workspace: work,
  startedAt: new Date(started).toISOString(), timeoutMs, traceCompiler }, null, 2));
const child = spawn(process.execPath, args, { cwd: work, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let output = '';
let timedOut = false;
for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => {
  const text = stripVTControlCharacters(chunk.toString());
  output += text;
  // The process has only fictitious environment values. Still do not dump env lines.
  const safe = text.split('\n').filter((line) => !/SECRET|PASSWORD|API_KEY|TOKEN=|process\.env/.test(line)).join('\n');
  process.stdout.write(safe);
  fs.writeFileSync(path.join(resultDir, 'build.log'), output.split('\n').filter((line) => !/SECRET|PASSWORD|API_KEY|TOKEN=|process\.env/.test(line)).join('\n'));
});
const timeout = setTimeout(() => {
  timedOut = true;
  console.error('A/B build exceeded diagnostic deadline; terminating diagnostic process tree');
  if (process.platform === 'win32') {
    spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  } else child.kill('SIGKILL');
}, timeoutMs);
child.on('error', (error) => { console.error(error.message); });
child.on('close', (code, signal) => {
  clearTimeout(timeout);
  const safeOutput = output.split('\n').filter((line) => !/SECRET|PASSWORD|API_KEY|TOKEN=|process\.env/.test(line)).join('\n');
  fs.writeFileSync(path.join(resultDir, 'build.log'), safeOutput);
  const outputDir = path.join(work, '.vercel/output');
  if (fs.existsSync(outputDir)) fs.cpSync(outputDir, path.join(resultDir, '.vercel/output'), { recursive: true, dereference: true });
  // This exact temporary file was created by this run in a newly allocated temp directory.
  if (variant === 'B' && fs.existsSync(temporaryConfig)) fs.unlinkSync(temporaryConfig);
  fs.writeFileSync(path.join(resultDir, 'result.json'), JSON.stringify({ variant, code, signal, timedOut,
    durationMs: Date.now() - started, workspace: work, node: process.version,
    command: ['node', cli, 'build', '--target', 'preview', '--global-config', '<isolated>'],
    temporaryConfigRemoved: !fs.existsSync(temporaryConfig),
  }, null, 2));
  console.log(`[AB ${variant}] exit=${code}; preserved at ${resultDir}`);
  process.exitCode = code ?? 1;
});
