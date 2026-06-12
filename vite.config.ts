import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/fair-share/',
  plugins: [vue()],
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
