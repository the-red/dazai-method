import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { createHandler } from './api'
import type { AppEnv } from './bindings'
import { handleLineWebhook } from './line'

// Worker のエントリ。静的アセットに一致しなかったリクエストがここに届く。
// 画面は Vite がビルドした静的アセットとして配信されるので、ここでは API だけを受ける
const app = new Hono<AppEnv>()

// Web API のボディ上限。Next.js の API Route が既定で持っていた 1MB 制限と同等にする。
// LINE Webhook は署名検証の都合で line.ts が自前で上限を見るので対象外
const webApiBodyLimit = bodyLimit({
  maxSize: 1024 * 1024,
  onError: (c) => c.json({ error: { message: '入力が長すぎます。' } }, 413),
})

// 太宰メソッド（世間を主語にした発言）を受け取り、主語を本人に戻した切り返しを返す
app.post(
  '/api/decode',
  webApiBodyLimit,
  createHandler((dazai, seken) => dazai.decode(seken)),
)
// 一人称の本音を受け取り、大きな主語に託した太宰メソッドの言い方に変換して返す
app.post(
  '/api/encode',
  webApiBodyLimit,
  createHandler((dazai, 本音) => dazai.encode(本音)),
)
// LINE Messaging API の Webhook。メソッドの判定（POST 以外は 405）はハンドラ側で行うので all で受ける
app.all('/api/line', handleLineWebhook)

export default app
