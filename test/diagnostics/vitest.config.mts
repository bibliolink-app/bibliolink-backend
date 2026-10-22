import { defineConfig } from 'vitest/config';
import existing from '../../vitest.config';

export default defineConfig({
  ...existing,
  test: {
    ...existing.test,
    include: ['test/diagnostics/metadata.probe.ts'],
    setupFiles: ['test/diagnostics/environment.cjs'],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
