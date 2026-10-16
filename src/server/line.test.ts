import { createHmac } from 'node:crypto'
import { beforeEach, expect, test, vi } from 'vitest'

// 太宰 クラスをモックし、OpenAI を呼ばずに Webhook の振る舞いだけを検証する。
// guide() / failed() の文言は lib/dazai.ts と同じにする
const GUIDE = '言葉にしていただかないと、わたしには判りかねます。文章で聞かせてください。'
const FAILED = '恥の多い生涯を送って来ました。返答の生成に失敗したのです。しばらくしてからもう一度お試しください。'
const { decodeMock, replyMock } = vi.hoisted(() => ({
  decodeMock: vi.fn<(text: string) => Promise<string>>(),
  replyMock: vi.fn<(req: unknown) => Promise<unknown>>(),
}))
vi.mock('../../lib/dazai', () => ({
  default: class {
    decode = decodeMock
    guide = () => GUIDE
    failed = () => FAILED
  },
}))
// 署名検証（validateSignature）は本物を使い、LINE への返信クライアントだけ差し替える
vi.mock('@line/bot-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@line/bot-sdk')>()),
  messagingApi: {
    MessagingApiClient: class {
      replyMessage = replyMock
    },
  },
}))

import app from './index'

const SECRET = 'test-channel-secret'
const ENV = { OPENAI_API_KEY: 'k', LINE_CHANNEL_SECRET: SECRET, LINE_CHANNEL_ACCESS_TOKEN: 't' }
const DUMMY_REPLY_TOKEN = '00000000000000000000000000000000'

const sign = (body: string) => createHmac('sha256', SECRET).update(body).digest('base64')

// 署名付きで POST する RequestInit を作る。signature を省略すると正しい署名を付ける
const signedPost = (body: string, signature = sign(body)): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Line-Signature': signature },
  body,
})

const textEvent = (replyToken: string, text: string) => ({
  type: 'message',
  replyToken,
  message: { type: 'text', id: '1', text },
})
const webhookBody = (events: unknown[]) => JSON.stringify({ destination: 'U0', events })

beforeEach(() => {
  decodeMock.mockReset()
  replyMock.mockReset()
  replyMock.mockResolvedValue({})
})

test('POST 以外は 405 で Allow: POST', async () => {
  const res = await app.request('/api/line', { method: 'GET' }, ENV)
  expect(res.status).toBe(405)
  expect(res.headers.get('Allow')).toBe('POST')
})

test('環境変数が欠けていれば 500', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const { LINE_CHANNEL_SECRET: _omitted, ...env } = ENV
  const res = await app.request('/api/line', signedPost(webhookBody([])), env)
  errorSpy.mockRestore()
  expect(res.status).toBe(500)
})

test('署名ヘッダーが無ければ 401', async () => {
  const res = await app.request(
    '/api/line',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: webhookBody([]) },
    ENV,
  )
  expect(res.status).toBe(401)
})

test('署名が一致しなければ 401', async () => {
  const res = await app.request('/api/line', signedPost(webhookBody([]), 'bad'), ENV)
  expect(res.status).toBe(401)
})

test('1MiB を超えるボディは 413', async () => {
  const body = 'a'.repeat(1024 * 1024 + 1)
  const res = await app.request('/api/line', signedPost(body), ENV)
  expect(res.status).toBe(413)
})

test('署名が正しくても JSON でなければ 400', async () => {
  const res = await app.request('/api/line', signedPost('{bad'), ENV)
  expect(res.status).toBe(400)
})

test('Webhook 検証のダミー replyToken には返信しない', async () => {
  const res = await app.request('/api/line', signedPost(webhookBody([textEvent(DUMMY_REPLY_TOKEN, 'x')])), ENV)
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ok: true })
  expect(replyMock).not.toHaveBeenCalled()
})

test('テキストメッセージには decode の結果を返信する', async () => {
  decodeMock.mockResolvedValue('A')
  const res = await app.request(
    '/api/line',
    signedPost(webhookBody([textEvent('tok', 'それは世間が、ゆるさない')])),
    ENV,
  )
  expect(res.status).toBe(200)
  expect(decodeMock).toHaveBeenCalledWith('それは世間が、ゆるさない')
  expect(replyMock).toHaveBeenCalledWith({ replyToken: 'tok', messages: [{ type: 'text', text: 'A' }] })
})

test('テキスト以外には guide() の文言を返信する', async () => {
  const sticker = {
    type: 'message',
    replyToken: 'tok',
    message: { type: 'sticker', id: '1', packageId: '1', stickerId: '1' },
  }
  const res = await app.request('/api/line', signedPost(webhookBody([sticker])), ENV)
  expect(res.status).toBe(200)
  expect(decodeMock).not.toHaveBeenCalled()
  expect(replyMock).toHaveBeenCalledWith({ replyToken: 'tok', messages: [{ type: 'text', text: GUIDE }] })
})

test('decode が失敗したら failed() の文言を返信する', async () => {
  decodeMock.mockRejectedValue(new Error('boom'))
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const res = await app.request('/api/line', signedPost(webhookBody([textEvent('tok', 'x')])), ENV)
  errorSpy.mockRestore()
  expect(res.status).toBe(200)
  expect(replyMock).toHaveBeenCalledWith({ replyToken: 'tok', messages: [{ type: 'text', text: FAILED }] })
})

test('複数イベントのうち 1 件の返信が失敗しても他は返信され 200', async () => {
  decodeMock.mockResolvedValue('A')
  replyMock.mockRejectedValueOnce(new Error('LINE API down'))
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const res = await app.request(
    '/api/line',
    signedPost(webhookBody([textEvent('tok1', 'x'), textEvent('tok2', 'y')])),
    ENV,
  )
  errorSpy.mockRestore()
  expect(res.status).toBe(200)
  expect(replyMock).toHaveBeenCalledTimes(2)
})
