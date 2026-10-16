import type { NextApiRequest, NextApiResponse } from 'next'
import { messagingApi, validateSignature, webhook } from '@line/bot-sdk'
import { NOT_DAZAI_METHOD, generateReply } from '../../lib/dazai'

// LINE Messaging API の Webhook エンドポイント
// 署名検証のため生のリクエストボディが必要なので、Next.js の JSON パースを無効化する
export const config = {
  api: { bodyParser: false },
  // OpenAI の応答待ちで Vercel の既定（10 秒）を超えることがあるため延長する
  maxDuration: 30,
}

// OpenAI 呼び出しに失敗したときに LINE へ返す文言
const FALLBACK_REPLY = '返答の生成に失敗しました。しばらくしてからもう一度お試しください。'

// LINE Developers コンソールの Webhook 検証で送られてくるダミーの replyToken
const DUMMY_REPLY_TOKEN = '00000000000000000000000000000000'

// 受け付けるリクエストボディの上限。LINE の Webhook はテキスト中心で数 KB 程度なので十分余裕がある
const MAX_BODY_BYTES = 1024 * 1024

// 上限を超えた場合に投げるエラー
class PayloadTooLargeError extends Error {}

// 署名検証の前に読むので、上限を超えたら即座に中断してメモリを浪費しない
const readRawBody = (req: NextApiRequest): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let received = 0
    req.on('data', (chunk: Buffer) => {
      received += chunk.length
      if (received > MAX_BODY_BYTES) {
        req.destroy()
        reject(new PayloadTooLargeError())
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

// 受け取ったメッセージに対する返答文を決める
const buildReplyText = async (message: webhook.MessageContent): Promise<string> => {
  if (message.type !== 'text') {
    // スタンプや画像など、テキスト以外が送られてきた場合
    return NOT_DAZAI_METHOD
  }
  try {
    return await generateReply(message.text)
  } catch (e) {
    console.error('Error with OpenAI API request:', e)
    return FALLBACK_REPLY
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).end()
    return
  }

  const channelSecret = process.env.LINE_CHANNEL_SECRET
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!channelSecret || !channelAccessToken) {
    console.error('LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN are not configured')
    res.status(500).end()
    return
  }

  // 署名ヘッダーがないリクエストはボディを読む前に拒否する
  const signature = req.headers['x-line-signature']
  if (typeof signature !== 'string') {
    res.status(401).end()
    return
  }

  // Content-Length が上限を超えていれば読み始める前に拒否する
  if (Number(req.headers['content-length']) > MAX_BODY_BYTES) {
    res.status(413).end()
    return
  }

  let rawBody: Buffer
  try {
    rawBody = await readRawBody(req)
  } catch (e) {
    res.status(e instanceof PayloadTooLargeError ? 413 : 400).end()
    return
  }

  // 署名を検証し、LINE プラットフォーム以外からのリクエストを拒否する
  if (!validateSignature(rawBody, channelSecret, signature)) {
    res.status(401).end()
    return
  }

  let body: webhook.CallbackRequest
  try {
    body = JSON.parse(rawBody.toString('utf8'))
  } catch {
    res.status(400).end()
    return
  }

  const client = new messagingApi.MessagingApiClient({ channelAccessToken })

  // 1 回の Webhook に複数イベントが含まれることがあるので全件処理する
  await Promise.all(
    body.events.map(async (event) => {
      if (event.type !== 'message' || !event.replyToken || event.replyToken === DUMMY_REPLY_TOKEN) return
      const text = await buildReplyText(event.message)
      try {
        await client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text }] })
      } catch (e) {
        console.error('Error with LINE reply API:', e)
      }
    }),
  )

  res.status(200).json({ ok: true })
}
