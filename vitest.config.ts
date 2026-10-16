import { defineConfig } from 'vitest/config'

// サーバー側（Hono）のテストだけを Node で実行する。
// Cloudflare の Vite プラグインは入れず、app.request() でハンドラを直接呼ぶ
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/server/**/*.test.ts'],
  },
})
