// Inherited by CLI/build child processes. No private or public network calls.
require('./environment.cjs');
const net = require('node:net');
net.Socket.prototype.connect = function () {
  throw new Error('AB diagnostic: network connections disabled');
};

// Optional observation for a slow compiler retry. No compiler options or emitted
// application code change; installed builder files remain untouched.
if (process.env.DIAGNOSTIC_BUILD_TRACE === '1') {
  const Module = require('node:module');
  const originalCompile = Module.prototype._compile;
  Module.prototype._compile = function (source, filename) {
    if (filename.replaceAll('\\', '/').endsWith('/@vercel/node/dist/index.js')) {
      const begin = 'const output = service.getEmitOutput(fileName);';
      const end = 'const diagnosticList = filterDiagnostics(diagnostics2, ignoreDiagnostics);';
      if (!source.includes(begin) || !source.includes(end)) throw new Error('Compiler observation markers changed');
      source = source.replace(begin,
        'const diagnosticStarted = Date.now(); console.error("[AB compiler start] " + fileName); ' + begin);
      source = source.replace(end, end +
        ' console.error("[AB compiler end] " + fileName + " " + (Date.now() - diagnosticStarted) + " ms");');
      console.error('[AB compiler observation] enabled; emission and type checking unchanged');
    }
    return originalCompile.call(this, source, filename);
  };
}
