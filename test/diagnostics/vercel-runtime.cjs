require('./environment.cjs');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { resolve, relative } = require('node:path');
const { get } = require('node:http');
const root = resolve(__dirname, '../..');
const cached = createRequire(resolve(process.argv[2]));
const builder = cached('@vercel/nestjs');
const nodeBuilder = cached('@vercel/node');

function request(port) {
  return new Promise((accept, reject) => {
    const req = get(`http://127.0.0.1:${port}/categories`, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        try { accept({ status: response.statusCode, body: JSON.parse(text) }); }
        catch (error) { reject(error); }
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error('Diagnostic HTTP timeout')));
    req.on('error', reject);
  });
}

async function run() {
  const base = { workPath: root, files: {}, entrypoint: 'package.json', config: {}, meta: { isDev: true } };
  assert.equal(await builder.entrypointCallback(base), 'src/main.ts');
  const compiled = await builder.entrypointCallback({ ...base, config: { projectSettings: { outputDirectory: 'dist' } } });
  assert.equal(compiled.replaceAll('\\', '/'), 'dist/main.js');
  console.log('[entrypoint] default=src/main.ts; outputDirectory=dist => dist/main.js');
  // Propagate only the diagnostic preloader to the runtime child; this process was sanitized by run.cjs.
  process.env.NODE_OPTIONS = `--require "${resolve(__dirname, 'environment.cjs').replaceAll('\\', '/')}"`;
  for (const [file, expected] of [['source-entry.ts', 503], ['compiled-entry.cjs', 200]]) {
    const server = await nodeBuilder.startDevServer({ ...base,
      entrypoint: relative(root, resolve(__dirname, 'fixtures', file)),
    });
    try {
      const result = await request(server.port);
      console.log('[official @vercel/node dev adapter]', file, JSON.stringify(result));
      assert.equal(result.status, expected);
      if (expected === 503) {
        assert.equal(result.body.metadata, null);
        assert.equal(result.body.error, 'UndefinedDependencyException');
        assert.equal(result.body.indexOne, true);
      } else {
        assert.equal(result.body.resolved, true);
        assert.equal(result.body.metadata[1], 'JwtService');
      }
    } finally { await server.shutdown(); }
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
