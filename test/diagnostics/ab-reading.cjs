require('./build-offline.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const dir = path.resolve(process.argv[2]);
const config = JSON.parse(fs.readFileSync(path.join(dir, '.vc-config.json'), 'utf8'));
const from = createRequire(path.join(dir, config.handler));
const pdfPath = from.resolve('pdfjs-dist/legacy/build/pdf.mjs');
if (!pdfPath.startsWith(dir + path.sep)) throw new Error('PDF import escaped Function');
const worker = path.join(path.dirname(pdfPath), 'pdf.worker.mjs');
const pdfRequire = createRequire(pdfPath);
let canvasInFunction = false;
try { canvasInFunction = pdfRequire.resolve('@napi-rs/canvas').startsWith(dir + path.sep); } catch {}
const report = { pdfLibraryPresent: true, workerPresent: fs.existsSync(worker), canvasInFunction };
(async () => {
  // No render if native canvas would silently fall back to the developer checkout.
  if (!canvasInFunction) {
    report.render = 'BLOCKED: canvas dependency absent from Function; refusing parent node_modules fallback';
  } else {
    const pdf = await import(pathToFileURL(pdfPath).href);
    report.pdfImport = !!pdf.getDocument;
  }
  console.log(JSON.stringify(report, null, 2));
  if (process.argv[3]) fs.writeFileSync(path.resolve(process.argv[3]), JSON.stringify(report, null, 2));
  if (!report.workerPresent || !report.canvasInFunction) process.exitCode = 1;
})().catch((error) => { console.log(JSON.stringify({ status: 'FAIL', name: error.name, code: error.code })); process.exitCode = 1; });
