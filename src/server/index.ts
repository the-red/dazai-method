import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { createHandler } from './api'
import type { AppEnv } from './bindings'
import { handleLineWebhook } from './line'

// Worker のエントリ。静的アセットに一致しなかったリクエストがここに届く。
// 画面は Vite がビルドした静的アセットとして配信されるので、ここでは API だけを受ける
const app = new Hono<AppEnv>()

// Web API のボディ上限。Next.js の API Route が既定で持っていた 1MB 制限と同等にする
const webApiBodyLimit = bodyLimit({
  maxSize: 1024 * 1024,
  onError: (c) => c.json({ error: { message: '入力が長すぎます。' } }, 413),
})
// LINE Webhook のボディ上限。LINE の Webhook はテキスト中心で数 KB 程度なので 1MiB あれば十分余裕がある。
// 上限を超えたら読み込みを途中で打ち切り、署名検証の前にメモリを浪費しない
const lineBodyLimit = bodyLimit({ maxSize: 1024 * 1024, onError: (c) => c.body(null, 413) })

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
app.all('/api/line', lineBodyLimit, handleLineWebhook)

export default app
