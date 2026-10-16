import { Hono } from 'hono'
import { createHandler } from './api'
import type { AppEnv } from './bindings'

// Worker のエントリ。静的アセットに一致しなかったリクエストがここに届く。
// 画面は Vite がビルドした静的アセットとして配信されるので、ここでは API だけを受ける
const app = new Hono<AppEnv>()

// 太宰メソッド（世間を主語にした発言）を受け取り、主語を本人に戻した切り返しを返す
app.post(
  '/api/decode',
  createHandler((dazai, seken) => dazai.decode(seken)),
)
// 一人称の本音を受け取り、大きな主語に託した太宰メソッドの言い方に変換して返す
app.post(
  '/api/encode',
  createHandler((dazai, 本音) => dazai.encode(本音)),
)

export default app
