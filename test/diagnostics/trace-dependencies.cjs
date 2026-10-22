// Bounded tracing probes, NOT a new Vercel build and NOT an application startup.
require('./build-offline.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const work = path.resolve(process.argv[2]);
const cached = createRequire(path.resolve(process.argv[3]));
const output = path.resolve(process.argv[4]);
const cases = {
  'typeorm-dynamic': "require('typeorm');\n",
  'mysql-literal': "require('mysql2');\n",
  'pdf-dynamic': "import('pdfjs-dist/legacy/build/pdf.mjs');\n",
  'pdf-explicit': "import('pdfjs-dist/legacy/build/pdf.mjs');\nimport('pdfjs-dist/legacy/build/pdf.worker.mjs');\nrequire('@napi-rs/canvas');\n",
};
if (process.argv[5]) {
  const name = process.argv[5];
  if (!Object.hasOwn(cases, name)) throw new Error('Unknown probe');
  const file = path.join(output, `__diagnostic_trace_${name}.cjs`);
  if (fs.existsSync(file)) throw new Error('Refusing to overwrite trace fixture');
  fs.writeFileSync(file, cases[name]);
  const { nodeFileTrace } = cached('@vercel/nft');
  const resolveDependency = cached('@vercel/nft/out/resolve-dependency.js').default;
  (async () => {
    try {
      const started = Date.now();
      const result = await nodeFileTrace([file], { base: work, processCwd: work,
        ts: true, mixedModules: true, moduleSyncCatchall: true,
        resolve: (id, parent, job, cjs) => resolveDependency(id, parent, job, cjs),
      });
      const files = [...result.fileList].map((item) => item.replaceAll('\\', '/')).sort();
      const report = { name, durationMs: Date.now() - started, files: files.length,
        mysql2: files.some((item) => /\/node_modules\/mysql2\//.test(item)),
        canvas: files.some((item) => item.includes('/node_modules/@napi-rs/canvas/')),
        worker: files.some((item) => item.endsWith('/legacy/build/pdf.worker.mjs')),
        natives: files.filter((item) => item.endsWith('.node')),
        warnings: result.warnings.size,
      };
      fs.writeFileSync(path.join(output, name + '.files.json'), JSON.stringify(files, null, 2));
      fs.writeFileSync(path.join(output, name + '.warnings.json'), JSON.stringify([...result.warnings].map((warning) => warning.message), null, 2));
      fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report));
    } finally { fs.unlinkSync(file); }
  })().catch((error) => { console.error(error.name + ': ' + error.message); process.exitCode = 1; });
} else {
  if (fs.existsSync(output)) throw new Error('Refusing to overwrite previous tracing evidence');
  fs.mkdirSync(output, { recursive: true });
  const from = createRequire(path.join(work, 'package.json'));
  const typeorm = createRequire(from.resolve('typeorm'));
  const pdf = createRequire(from.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
  const installed = { mysql2: path.relative(work, typeorm.resolve('mysql2')),
    canvas: path.relative(work, pdf.resolve('@napi-rs/canvas')),
    worker: fs.existsSync(path.join(path.dirname(pdf.resolve('pdfjs-dist/legacy/build/pdf.mjs')), 'pdf.worker.mjs')) };
  fs.writeFileSync(path.join(output, 'installed.json'), JSON.stringify(installed, null, 2));
  for (const [name, source] of Object.entries(cases)) {
    fs.writeFileSync(path.join(output, name + '.cjs'), source);
    const child = spawnSync(process.execPath, [__filename, work, process.argv[3], output, name],
      { encoding: 'utf8', windowsHide: true, timeout: 45000 });
    fs.writeFileSync(path.join(output, name + '.log'), (child.stdout ?? '') + (child.stderr ?? ''));
    console.log(child.stdout || `${name}: ${child.error?.message ?? 'exit ' + child.status}`);
    if (child.error || child.status !== 0) process.exitCode = 1;
  }
}
