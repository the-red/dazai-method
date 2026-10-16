// Worker に設定するシークレット。Cloudflare ダッシュボードの Variables & Secrets（ローカルは .dev.vars）で与える。
// どれも未設定でありうるので省略可能にし、各ハンドラが確認してから使う
export type Bindings = {
  OPENAI_API_KEY?: string
  LINE_CHANNEL_SECRET?: string
  LINE_CHANNEL_ACCESS_TOKEN?: string
}

// Hono の環境型。Hono 自身の Env 型と混同しないよう AppEnv と呼ぶ
export type AppEnv = { Bindings: Bindings }
