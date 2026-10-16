import { Buffer } from 'node:buffer'
import type { Handler } from 'hono'
import { messagingApi, validateSignature, webhook } from '@line/bot-sdk'
import 太宰 from '../../lib/dazai'
import type { AppEnv } from './bindings'

// LINE Developers コンソールの Webhook 検証で送られてくるダミーの replyToken
const DUMMY_REPLY_TOKEN = '00000000000000000000000000000000'

// 受け付けるリクエストボディの上限。LINE の Webhook はテキスト中心で数 KB 程度なので十分余裕がある
const MAX_BODY_BYTES = 1024 * 1024

// 受け取ったメッセージに対する返答文を決める
const buildReplyText = async (dazai: 太宰, message: webhook.MessageContent): Promise<string> => {
  if (message.type !== 'text') {
    // スタンプや画像など、テキスト以外が送られてきた場合
    return dazai.guide()
  }
  try {
    return await dazai.decode(message.text)
  } catch (e) {
    console.error('Error with OpenAI API request:', e)
    return dazai.failed()
  }
}

// LINE Messaging API の Webhook エンドポイント。
// 署名検証のため生のボディをそのまま読み、LINE プラットフォーム以外からのリクエストは 401 で拒否する
export const handleLineWebhook: Handler<AppEnv> = async (c) => {
  if (c.req.method !== 'POST') {
    return c.body(null, 405, { Allow: 'POST' })
  }

  const {
    LINE_CHANNEL_SECRET: channelSecret,
    LINE_CHANNEL_ACCESS_TOKEN: channelAccessToken,
    OPENAI_API_KEY: apiKey,
  } = c.env
  if (!channelSecret || !channelAccessToken || !apiKey) {
    console.error('LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN / OPENAI_API_KEY are not configured')
    return c.body(null, 500)
  }

  // 署名ヘッダーがないリクエストはボディを読む前に拒否する
  const signature = c.req.header('x-line-signature')
  if (!signature) {
    return c.body(null, 401)
  }

  // Content-Length が上限を超えていれば読み始める前に拒否する。
  // ヘッダーが無い場合に備え、読み終えた後にも実サイズで確認する
  if (Number(c.req.header('content-length')) > MAX_BODY_BYTES) {
    return c.body(null, 413)
  }
  const rawBody = Buffer.from(await c.req.arrayBuffer())
  if (rawBody.byteLength > MAX_BODY_BYTES) {
    return c.body(null, 413)
  }

  // 署名を検証し、LINE プラットフォーム以外からのリクエストを拒否する
  if (!validateSignature(rawBody, channelSecret, signature)) {
    return c.body(null, 401)
  }

  let body: webhook.CallbackRequest
  try {
    body = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return c.body(null, 400)
  }

  const client = new messagingApi.MessagingApiClient({ channelAccessToken })
  const dazai = new 太宰({ apiKey })

  // 1 回の Webhook に複数イベントが含まれることがあるので全件処理する
  await Promise.all(
    body.events.map(async (event) => {
      if (event.type !== 'message' || !event.replyToken || event.replyToken === DUMMY_REPLY_TOKEN) return
      const text = await buildReplyText(dazai, event.message)
      try {
        await client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text }] })
      } catch (e) {
        console.error('Error with LINE reply API:', e)
      }
    }),
  )

  return c.json({ ok: true })
}
