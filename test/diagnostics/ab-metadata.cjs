// Import from the preserved Function itself, without importing main or starting Nest.
require('./build-offline.cjs');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const dir = path.resolve(process.argv[2]);
const config = JSON.parse(fs.readFileSync(path.join(dir, '.vc-config.json'), 'utf8'));
const originalResolve = Module._resolveFilename;
const report = { status: 'RUNNING', handler: config.handler, databaseConnected: false };
Module._resolveFilename = function (specifier, parent, ...rest) {
  const resolved = originalResolve.call(this, specifier, parent, ...rest);
  if (parent?.filename?.startsWith(dir + path.sep) && path.isAbsolute(resolved) && !resolved.startsWith(dir + path.sep)) {
    throw new Error(`Packaged dependency resolves outside Function: ${specifier}`);
  }
  return resolved;
};
(async () => { try {
  const from = Module.createRequire(path.join(dir, config.handler));
  // Nest loads reflect-metadata from its own traced dependency; do not invent a root import.
  const { AuthService } = from('./auth/auth.service.js');
  const types = Reflect.getMetadata('design:paramtypes', AuthService)?.map((type) => type.name);
  assert.deepEqual(types, ['PinoLogger', 'JwtService', 'UsersService', 'PasswordHasherService', 'CaptchaService', 'EmailService', 'Repository']);
  const { AppModule } = from('./app.module.js');
  const { DataSource, getMetadataArgsStorage } = from('typeorm');
  DataSource.prototype.initialize = async () => { throw new Error('Packaged database initialization forbidden'); };
  Object.assign(report, { authMetadata: 'PASS', authDependencyTypes: types,
    explicitInjectionIndexes: Reflect.getMetadata('self:paramtypes', AuthService).map(({ index }) => index).sort(),
    appModuleImport: typeof AppModule === 'function', entityTableMetadataCount: getMetadataArgsStorage().tables.length });
  const entities = getMetadataArgsStorage().tables.map(({ target }) => target);
  const source = new DataSource({ type: 'mysql', entities, synchronize: false });
  // TypeORM metadata construction only: never initialize, query, migrate or seed.
  await source.buildMetadatas();
  Object.assign(report, { status: 'PASS',
    builtEntityMetadataCount: source.entityMetadatas.length,
    mysqlDriverLoaded: !!source.driver,
    databaseConnected: false });
} catch (error) {
  Object.assign(report, { status: 'FAIL', errorName: error.name, code: error.code,
    message: error.message.split('\n')[0] });
  process.exitCode = 1;
} finally {
  Module._resolveFilename = originalResolve;
  console.log(JSON.stringify(report, null, 2));
  if (process.argv[3]) fs.writeFileSync(path.resolve(process.argv[3]), JSON.stringify(report, null, 2));
} })();
