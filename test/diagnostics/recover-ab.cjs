const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, 'results/ab-build-07/A');
const started = JSON.parse(fs.readFileSync(path.join(root, 'started.json'), 'utf8'));
const logPath = path.join(root, 'build.log');
const log = fs.readFileSync(logPath, 'utf8');
const recovered = path.join(root, 'recovered');
if (fs.existsSync(recovered)) throw new Error('Refusing to overwrite recovered evidence');
fs.mkdirSync(recovered);
for (const relative of ['dist', '.vercel/output']) {
  const source = path.join(started.workspace, relative);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(recovered, relative), { recursive: true });
}
const auth = fs.readFileSync(path.join(recovered, 'dist/auth/auth.service.js'), 'utf8');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const a = JSON.parse(fs.readFileSync(path.join(root, 'inputs.json'), 'utf8'));
const b = JSON.parse(fs.readFileSync(path.join(__dirname, 'results/ab-build-06/B/inputs.json'), 'utf8'));
const report = {
  status: 'INCOMPLETE', processActive: false, processCheck: 'OS command-line inspection: remaining Node processes belong to another project',
  exitCode: null, exitCodeReason: 'No result.json or recoverable process handle; do not infer a code',
  startedAt: started.startedAt, lastLogAt: fs.statSync(logPath).mtime.toISOString(),
  lastObservedElapsedMs: Math.round(fs.statSync(logPath).mtimeMs - Date.parse(started.startedAt)),
  configuredTimeoutMs: started.timeoutMs,
  compilerCyclesStarted: (log.match(/\[AB compiler start\]/g) ?? []).length,
  compilerCyclesCompleted: (log.match(/\[AB compiler end\]/g) ?? []).length,
  outputConfigExists: fs.existsSync(path.join(recovered, '.vercel/output/config.json')),
  functionConfigExists: fs.existsSync(path.join(recovered, '.vercel/output/functions/index.func/.vc-config.json')),
  nestDistMainSha256: hash(fs.readFileSync(path.join(recovered, 'dist/main.js'))),
  nestDistAuthSha256: hash(auth),
  nestDistAuthMetadata: auth.match(/__metadata\("design:paramtypes",\s*\[[\s\S]*?\]\)/)?.[0],
  artifactScope: 'Recovered dist is nest build output, NOT a Vercel Function',
  identicalApplicationInputsToB: JSON.stringify(a.inputs) === JSON.stringify(b.inputs),
  identicalProjectSettingsToB: JSON.stringify(a.localSettings) === JSON.stringify(b.localSettings),
};
fs.writeFileSync(path.join(root, 'recovery.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
