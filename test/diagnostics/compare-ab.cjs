const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(process.argv[2]);
const variantRoots = { A: path.resolve(process.argv[3] ?? path.join(root, 'A')),
  B: path.resolve(process.argv[4] ?? path.join(root, 'B')) };
fs.mkdirSync(root, { recursive: true });
const load = (name) => JSON.parse(fs.readFileSync(path.join(variantRoots[name[0]], name.slice(2)), 'utf8'));
const a = load('A/materialized/function-manifest.json');
const b = load('B/materialized/function-manifest.json');
const normalize = (file) => file.path.replace(/^(src|dist)\//, 'app/');
const am = new Map(a.map((file) => [normalize(file), file]));
const bm = new Map(b.map((file) => [normalize(file), file]));
const onlyA = [...am.keys()].filter((key) => !bm.has(key));
const onlyB = [...bm.keys()].filter((key) => !am.has(key));
const different = [...am.keys()].filter((key) => bm.has(key) && am.get(key).sha256 !== bm.get(key).sha256);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const inputA = load('A/inputs.json');
const inputB = load('B/inputs.json');
const configA = load('A/.vercel/output/config.json');
const configB = load('B/.vercel/output/config.json');
const result = {
  variantRoots,
  identicalSourceAndLockfileInputs: JSON.stringify(inputA.inputs) === JSON.stringify(inputB.inputs),
  identicalProjectSettings: JSON.stringify(inputA.localSettings) === JSON.stringify(inputB.localSettings),
  configDifference: { A: inputA.vercelConfig, B: inputB.vercelConfig },
  identicalOutputRouting: JSON.stringify(configA) === JSON.stringify(configB),
  onlyA, onlyB, different,
  dependencyDifferences: { onlyA: onlyA.filter((key) => key.startsWith('node_modules/')),
    onlyB: onlyB.filter((key) => key.startsWith('node_modules/')),
    changed: different.filter((key) => key.startsWith('node_modules/')) },
  filesDifferingBeyondSourceMapComment: different.filter((key) => {
    if (!key.startsWith('app/') || !key.endsWith('.js')) return false;
    const read = (variant, file) => fs.readFileSync(path.join(variantRoots[variant],
      'materialized/.vercel/output/functions/index.func', file.path), 'utf8').replace(/\/\/# sourceMappingURL=.*$/gm, '');
    return sha(read('A', am.get(key))) !== sha(read('B', bm.get(key)));
  }),
};
fs.writeFileSync(path.join(root, 'comparison.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
