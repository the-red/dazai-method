import { describe, expect, test, vi, beforeEach } from 'vitest'

// 太宰 クラスをモックし、OpenAI を呼ばずに API の契約だけを検証する
const { decodeMock, encodeMock } = vi.hoisted(() => ({
  decodeMock: vi.fn<(text: string) => Promise<string>>(),
  encodeMock: vi.fn<(text: string) => Promise<string>>(),
}))
vi.mock('../../lib/dazai', () => ({
  default: class {
    decode = decodeMock
    encode = encodeMock
  },
}))

import app from './index'

const ENV = { OPENAI_API_KEY: 'test-key' }
const INVALID_INPUT = { error: { message: '入力内容が正しくありません。' } }

// JSON ボディを POST する RequestInit を作る。string はそのまま生ボディとして送る
const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
})

beforeEach(() => {
  decodeMock.mockReset()
  encodeMock.mockReset()
})

describe('POST /api/decode, /api/encode', () => {
  test('POST /api/decode は 太宰.decode の結果を返す', async () => {
    decodeMock.mockResolvedValue('世間じゃない。あなたが、ゆるさないのでしょう？')
    const res = await app.request('/api/decode', post({ text: 'それは世間が、ゆるさない' }), ENV)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ result: '世間じゃない。あなたが、ゆるさないのでしょう？' })
    expect(decodeMock).toHaveBeenCalledWith('それは世間が、ゆるさない')
  })

  test('POST /api/encode は 太宰.encode を呼ぶ', async () => {
    encodeMock.mockResolvedValue('世間は、残業を望んでいない')
    const res = await app.request('/api/encode', post({ text: '俺は、残業したくない' }), ENV)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ result: '世間は、残業を望んでいない' })
    expect(encodeMock).toHaveBeenCalledWith('俺は、残業したくない')
    expect(decodeMock).not.toHaveBeenCalled()
  })

  test('空文字の text は 400', async () => {
    const res = await app.request('/api/decode', post({ text: '   ' }), ENV)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(INVALID_INPUT)
    expect(decodeMock).not.toHaveBeenCalled()
  })

  test('text が文字列でなければ 400', async () => {
    for (const body of [{ text: 123 }, {}]) {
      const res = await app.request('/api/decode', post(body), ENV)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual(INVALID_INPUT)
    }
    expect(decodeMock).not.toHaveBeenCalled()
  })

  test('JSON として壊れたボディは 400', async () => {
    const res = await app.request('/api/decode', post('{bad'), ENV)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(INVALID_INPUT)
  })

  test('OPENAI_API_KEY が無ければ 500', async () => {
    const res = await app.request('/api/decode', post({ text: 'それは世間が、ゆるさない' }), {})
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: { message: 'OpenAI API key not configured, please follow instructions in README.md' },
    })
    expect(decodeMock).not.toHaveBeenCalled()
  })

  test('太宰 が例外を投げたら 500', async () => {
    decodeMock.mockRejectedValue(new Error('boom'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await app.request('/api/decode', post({ text: 'それは世間が、ゆるさない' }), ENV)
    errorSpy.mockRestore()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: { message: 'An error occurred during your request.' } })
  })
})

test('未知のパスは 404', async () => {
  for (const path of ['/api/nope', '/nope']) {
    const res = await app.request(path, {}, ENV)
    expect(res.status).toBe(404)
  }
})

test('1MiB を超えるボディは 413', async () => {
  const text = 'a'.repeat(1024 * 1024)
  const res = await app.request('/api/decode', post({ text }), ENV)
  expect(res.status).toBe(413)
  expect(await res.json()).toEqual({ error: { message: '入力が長すぎます。' } })
  expect(decodeMock).not.toHaveBeenCalled()
})
