// Static inventory of actual Vercel Build Output API artifacts; no application boot.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(process.argv[2]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function walk(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix + entry.name;
    if (entry.isSymbolicLink()) return []; // Junction targets already counted at their physical location.
    return entry.isDirectory() ? walk(path.join(dir, entry.name), relative + '/') : [relative];
  });
}
const output = path.join(root, '.vercel/output');
const all = walk(output);
const config = JSON.parse(fs.readFileSync(path.join(output, 'config.json'), 'utf8'));
const functions = [];
for (const configPath of all.filter((file) => file.endsWith('/.vc-config.json'))) {
  const dir = path.dirname(path.join(output, configPath));
  const raw = JSON.parse(fs.readFileSync(path.join(dir, '.vc-config.json'), 'utf8'));
  // Explicit metadata allowlist: never serialize environment or arbitrary config values.
  const safe = Object.fromEntries(['runtime', 'handler', 'architecture', 'awsLambdaHandler', 'launcherType', 'shouldAddHelpers',
    'shouldAddSourcemapSupport', 'supportsResponseStreaming', 'framework'].filter((key) => key in raw).map((key) => [key, raw[key]]));
  const files = walk(dir);
  const appRoot = safe.handler?.startsWith('dist/') ? 'dist/' : 'src/';
  const appFiles = files.filter((file) => file.startsWith(appRoot) && file.endsWith('.js'));
  const missing = [];
  const escaped = [];
  let metadataCount = 0;
  for (const file of appFiles) {
    const absolute = path.join(dir, file);
    const source = fs.readFileSync(absolute, 'utf8');
    metadataCount += [...source.matchAll(/__metadata\("design:paramtypes"/g)].length;
    const from = createRequire(absolute);
    for (const [, specifier] of source.matchAll(/(?:require|import)\(["']([^"']+)["']\)/g)) {
      try {
        const resolved = from.resolve(specifier);
        if (path.isAbsolute(resolved) && !resolved.startsWith(dir + path.sep)) escaped.push({ file, specifier });
      } catch (error) { missing.push({ file, specifier, code: error.code }); }
    }
  }
  const auth = appRoot + 'auth/auth.service.js';
  const authSource = fs.readFileSync(path.join(dir, auth), 'utf8');
  const inventory = files.map((file) => {
    const bytes = fs.readFileSync(path.join(dir, file));
    return { path: file, size: bytes.length, sha256: hash(bytes) };
  });
  const packages = files.filter((file) => file.startsWith('node_modules/') && file.endsWith('/package.json')).flatMap((file) => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    return typeof data.name === 'string' && typeof data.version === 'string'
      ? [{ path: file, name: data.name, version: data.version }] : [];
  });
  fs.writeFileSync(path.join(root, 'packages.json'), JSON.stringify(packages, null, 2));
  fs.writeFileSync(path.join(root, 'function-manifest.json'), JSON.stringify(inventory, null, 2));
  functions.push({ configPath, configKeys: Object.keys(raw), config: safe,
    handlerExists: fs.existsSync(path.join(dir, safe.handler)),
    fileCount: files.length, bytes: inventory.reduce((sum, file) => sum + file.size, 0),
    packageManifestCount: packages.length,
    applicationJavaScriptFiles: appFiles.length, metadataCount, auth,
    entities: appFiles.filter((file) => file.endsWith('.entity.js')),
    readingFiles: appFiles.filter((file) => file.startsWith(appRoot + 'reading/')),
    pdfAssets: files.filter((file) => /pdfjs-dist.*\/(pdf(?:\.worker)?\.mjs|[^/]+\.wasm)$/.test(file)),
    authMetadata: authSource.match(/__metadata\("design:paramtypes",\s*\[[\s\S]*?\]\)/)?.[0],
    distMainPresent: files.includes('dist/main.js'), srcMainPresent: files.includes('src/main.js'),
    nativeFiles: files.filter((file) => file.endsWith('.node')),
    dynamicDependencies: Object.fromEntries(['mysql2', '@napi-rs/canvas'].map((name) => [name,
      files.some((file) => file.includes('/node_modules/' + name + '/'))])),
    sensitiveFilenames: files.filter((file) => /(^|\/)\.env($|\.)|(^|\/)auth\.json$|(^|\/)\.npmrc$/.test(file)),
    missingApplicationImports: missing, applicationImportsOutsideFunction: escaped,
  });
}
const report = { config, functions,
  staticFiles: all.filter((file) => file.startsWith('static/')) };
fs.writeFileSync(path.join(root, 'inspection.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
