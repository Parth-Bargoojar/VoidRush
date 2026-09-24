import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

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
  plugins: [
    react(),
    // PWA layer: manifest + Workbox service worker. Production builds only —
    // `npm run dev` never registers a worker, so localhost is never controlled
    // by a stale cache. Verify with `npm run build && npm run preview`.
    VitePWA({
      // 'prompt': a new worker waits until the player accepts the update from a
      // safe screen (see src/pwa/pwa.ts); a run is never reloaded underneath.
      registerType: 'prompt',
      // Registration lives in src/pwa/pwa.ts, not an injected script.
      injectRegister: false,
      devOptions: { enabled: false },
      manifest: {
        id: './',
        name: 'VOIDRUSH',
        short_name: 'VOIDRUSH',
        description:
          'A first-person endless flight through a voxel tunnel. Dodge, thread the gap, go faster.',
        // Relative to the manifest, so this is `/` on a root deploy and still
        // correct if the build (base: './') is served from a sub-path.
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#080a0f',
        theme_color: '#080a0f',
        categories: ['games', 'entertainment'],
        lang: 'en',
        dir: 'ltr',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          {
            src: 'icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell: Vite's hashed bundles, the HTML and the icons are
        // precached and revisioned, so a deploy swaps them atomically.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,txt,woff2}'],
        // Offline launches of the app URL (with any query, e.g. ?seed=) get the
        // cached shell. The game has no routes; other paths are not app pages
        // (and, with base './', could not resolve the relative asset URLs).
        navigateFallback: 'index.html',
        // Workbox tests pathname + search, so a query may follow the path.
        navigateFallbackAllowlist: [/^[^?]*\/(?:index\.html)?(?:\?.*)?$/],
        cleanupOutdatedCaches: true,
        // Never take over mid-session; the update prompt triggers skipWaiting.
        skipWaiting: false,
        clientsClaim: false,
        runtimeCaching: [
          {
            // The optional soundtrack streams through <audio>, which issues
            // range requests; precaching those is unreliable (Safari), so it is
            // cached on first play and sliced from the cache offline.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\.(?:mp3|ogg|m4a|wav)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'voidrush-audio',
              cacheableResponse: { statuses: [200] },
              rangeRequests: true,
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
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
