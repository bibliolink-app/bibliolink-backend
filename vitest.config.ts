import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    // Compilar un módulo de Nest en `beforeEach` puede pasar los 10 s por
    // omisión cuando muchas pruebas cargan módulos en paralelo.
    hookTimeout: 30_000,
    testTimeout: 30_000,
    include: ['**/*.spec.ts'],
  },
});
