import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig } from 'vitest/config'

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim()

export default defineConfig({
  build: {
    // 인증 토큰이 있는 배포에서만 map을 만들고, 업로드 후 삭제해 공개 배포를 막습니다.
    sourcemap: sentryAuthToken ? 'hidden' : false,
  },
  plugins: [
    react(),
    ...(sentryAuthToken
      ? [sentryVitePlugin({
          org: 'kgb-w6',
          project: 'kgb-front',
          authToken: sentryAuthToken,
          sourcemaps: {
            filesToDeleteAfterUpload: ['./dist/**/*.map'],
          },
        })]
      : []),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
