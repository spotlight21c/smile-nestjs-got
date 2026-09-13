import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: '.',
    include: ['test/**/*.spec.ts'],
    testTimeout: 20000,
  },
  plugins: [
    // NestJS relies on `emitDecoratorMetadata` for type-based DI, which esbuild
    // (vitest's default transformer) does not emit. swc handles it.
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),
  ],
});
