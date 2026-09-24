import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * An optional soundtrack: drop `public/soundtrack.mp3` in and the build ships
 * it, and the game fades it in instead of the procedural synth. Detected at
 * build time so a build without it never requests a missing file (which would
 * log a 404 in the console). The dev server needs a restart to notice it.
 */
const HAS_SOUNDTRACK = existsSync(
  fileURLToPath(new URL('./public/soundtrack.mp3', import.meta.url)),
);

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __VOIDRUSH_HAS_SOUNDTRACK__: JSON.stringify(HAS_SOUNDTRACK),
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Libraries change far less often than game code. Separate chunks keep
        // their content hash stable, so a returning player re-downloads only
        // the small app chunk after a deploy (assets are cached as immutable).
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  test: {
    // Node by default; DOM-facing suites opt in with an @vitest-environment
    // docblock so the simulation tests never pay for a jsdom window.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: ['default'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});
