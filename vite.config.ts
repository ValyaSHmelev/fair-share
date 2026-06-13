import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/fair-share/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'FairShare — делим счёт по-честному',
        short_name: 'FairShare',
        description: 'Делим счёт по-честному между участниками',
        lang: 'ru',
        theme_color: '#6366f1',
        background_color: '#18181b',
        display: 'standalone',
        start_url: '/fair-share/',
        scope: '/fair-share/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/fair-share/index.html',
        navigateFallbackDenylist: [/^\/fair-share\/404\.html$/],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // @ts-expect-error — конфиг Vitest читается в рантайме, тип vite не включает поле test
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
