import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

// 画面（React）と Worker（Hono）を 1 つの Vite プロジェクトとして扱う。
// Cloudflare プラグインは wrangler.jsonc を読み、Worker のビルドと開発サーバーでの実行を担当する
export default defineConfig({
  plugins: [react(), cloudflare({ viteEnvironment: { name: 'worker' } })],
  environments: {
    worker: { build: { sourcemap: true } },
  },
})
