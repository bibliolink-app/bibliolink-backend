const { createServer } = require('node:http');
const { Test } = require('@nestjs/testing');
const { JwtModule } = require('@nestjs/jwt');
const { getLoggerToken } = require('nestjs-pino');
const { getRepositoryToken } = require('@nestjs/typeorm');

exports.serve = (AuthService, PasswordResetToken, dependencies) => {
  const metadata = Reflect.getMetadata('design:paramtypes', AuthService);
  // Start the fixture server immediately; only its diagnostic request initializes Nest.
  // This isolates transformation from asynchronous server detection.
  createServer(async (_request, response) => {
    let module;
    try {
      module = await Test.createTestingModule({
        imports: [JwtModule.register({})],
        providers: [AuthService,
          { provide: getLoggerToken(AuthService.name), useValue: {} },
          { provide: getRepositoryToken(PasswordResetToken), useValue: {} },
          ...dependencies.map((provide) => ({ provide, useValue: {} })),
        ],
      }).compile();
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ metadata: metadata.map((item) => item.name), resolved: true }));
    } catch (error) {
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ metadata: metadata ?? null, error: error.constructor.name,
        indexOne: /index \[1\]/.test(error.message) }));
    } finally { await module?.close(); }
  }).listen(0);
};
