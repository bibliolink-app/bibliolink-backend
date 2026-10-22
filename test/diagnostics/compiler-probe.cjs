require('./environment.cjs');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { Module, createRequire } = require('node:module');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve, dirname, join } = require('node:path');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const { JwtService } = require('@nestjs/jwt');
const root = resolve(__dirname, '../..');
const cached = createRequire(resolve(process.argv[2]));
const filename = cached.resolve('@vercel/node');
const source = readFileSync(filename, 'utf8');

// Expose the actual internal compiler in memory. Do not edit installed packages.
// This exercises the build compiler, NOT the private hosted invocation runtime.
assert.match(source, /function register\(opts = \{\}\)/);
const instrumented = new Module(filename);
instrumented.filename = filename;
instrumented.paths = Module._nodeModulePaths(dirname(filename));
instrumented._compile(source + '\nmodule.exports.diagnostic = { register, renameTStoJS };\n', filename);
const { register, renameTStoJS } = instrumented.exports.diagnostic;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function run() {
  process.env.EXPERIMENTAL_NODE_TYPESCRIPT_ERRORS = '1';
  const compile = register({ basePath: root, project: join(root, 'src/main.ts'), rootDir: root, files: true, nodeVersionMajor: 24 });
  const output = resolve(__dirname, 'results/compiler');
  mkdirSync(output, { recursive: true });
  for (const file of ['src/main.ts', 'src/auth/auth.service.ts']) {
    const absolute = join(root, file);
    const result = await compile(readFileSync(absolute, 'utf8'), absolute);
    const target = join(output, file.endsWith('main.ts') ? 'main.js' : 'auth.service.js');
    writeFileSync(target, result.code);
    console.log('[build compiler]', file, '=>', renameTStoJS(file), 'sha256=' + sha256(result.code));
    if (file.endsWith('auth.service.ts')) {
      assert.match(result.code, /__metadata\("design:paramtypes"/);
      // Resolve imported dependencies from the already verified Nest build.
      // Only AuthService itself is evaluated from the Vercel compiler output.
      const authPath = join(root, 'dist/auth/auth.service.js');
      const auth = new Module(authPath);
      auth.filename = authPath;
      auth.paths = Module._nodeModulePaths(dirname(authPath));
      auth._compile(result.code, authPath);
      const metadata = Reflect.getMetadata('design:paramtypes', auth.exports.AuthService);
      assert.equal(metadata.length, 7);
      assert.equal(metadata[1], JwtService);
      console.log('[build compiler metadata]', metadata.map((item) => item.name).join(', '));
    } else {
      const events = [];
      let release;
      const waiting = new Promise((accept) => { release = accept; });
      const app = { useLogger() {}, get() {}, use() {}, enableCors() {}, useGlobalPipes() {}, useGlobalFilters() {},
        listen: async () => { events.push('listen'); } };
      const localRequire = createRequire(join(root, 'dist/main.js'));
      const context = {
        exports: {},
        require(id) {
          if (id === '@nestjs/core') return { NestFactory: { create: () => {
            events.push('bootstrap:create-start');
            return waiting.then(() => app);
          } } };
          if (id === './app.module') return { AppModule: class AppModule {} };
          return localRequire(id);
        },
      };
      vm.runInNewContext(result.code, context, { filename: target });
      events.push('module-evaluation-returned');
      assert.deepEqual(events, ['bootstrap:create-start', 'module-evaluation-returned']);
      assert.deepEqual(Object.keys(context.exports), []);
      release();
      await new Promise((accept) => setImmediate(accept));
      assert.equal(events.at(-1), 'listen');
      console.log('[bootstrap ordering; NestFactory double]', events.join(' -> '));
    }
  }
  console.log('[cached builder SHA256]', sha256(source));
  const olderPath = resolve(__dirname, 'results/public-packages/node22/package/dist/index.js');
  try {
    const oldHash = sha256(readFileSync(olderPath));
    assert.equal(oldHash, sha256(source));
    console.log('[public node22 / cached node24] index.js byte-identical');
  } catch (error) {
    if (error.code === 'ENOENT') console.log('[comparison] NOT RUN: optional public node22 artifact missing');
    else throw error;
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
