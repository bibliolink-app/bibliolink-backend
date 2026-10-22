// Local inspection copy only. Keep the official CLI output unchanged.
// Windows pnpm directory junctions appear in Vercel's official filePathMap.
// Recreate only those selected references, pointing INSIDE the inspection copy.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2]);
const { workspace } = JSON.parse(fs.readFileSync(path.join(root, 'result.json'), 'utf8'));
const original = path.join(root, '.vercel/output');
const dest = path.join(root, 'materialized/.vercel/output');
if (fs.existsSync(dest)) throw new Error('Refusing to overwrite materialized evidence');
fs.cpSync(original, dest, { recursive: true });
function within(base, value) {
  const relative = path.relative(base, value);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Path escapes diagnostic workspace');
  return relative;
}
const records = [];
for (const name of fs.readdirSync(path.join(dest, 'functions'))) {
  const dir = path.join(dest, 'functions', name);
  const configPath = path.join(dir, '.vc-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  for (const [key, source] of Object.entries(config.filePathMap ?? {})) {
    const input = path.resolve(workspace, source);
    within(workspace, input);
    const output = path.resolve(dir, key);
    within(dir, output);
    const stat = fs.lstatSync(input);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    if (stat.isSymbolicLink()) {
      const relativeTarget = within(workspace, fs.realpathSync(input));
      const target = path.join(dir, relativeTarget);
      within(dir, target);
      if (!fs.statSync(target).isDirectory()) throw new Error('Expected packaged directory for junction');
      fs.symlinkSync(target, output, 'junction');
      records.push({ function: name, path: key, target: relativeTarget.replaceAll('\\', '/') });
    } else if (stat.isFile()) {
      fs.copyFileSync(input, output);
    } else throw new Error('Unexpected filePathMap entry');
  }
  delete config.filePathMap;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
fs.writeFileSync(path.join(root, 'materialization.json'), JSON.stringify({
  purpose: 'Local inspection only; official CLI output preserved separately; no extra package contents copied',
  junctions: records,
}, null, 2));
console.log(`Materialized ${records.length} selected directory references inside ${dest}`);
