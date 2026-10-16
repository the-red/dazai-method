import type { Handler } from 'hono'
import 太宰 from '../../lib/dazai'
import type { AppEnv } from './bindings'

// 太宰メソッドを 1 つ公開する Web 用 API のハンドラを作る。
// リクエストは { text: string }、レスポンスは { result } または { error: { message } }。
// API キーの確認、入力検証、エラー処理はここで共通化し、各ルートはどの太宰メソッドを呼ぶかだけを書く
export const createHandler =
  (invoke: (dazai: 太宰, text: string) => Promise<string>): Handler<AppEnv> =>
  async (c) => {
    const apiKey = c.env.OPENAI_API_KEY
    if (!apiKey) {
      return c.json(
        { error: { message: 'OpenAI API key not configured, please follow instructions in README.md' } },
        500,
      )
    }

    // JSON として壊れたボディは空の入力として扱い、下の検証で 400 にする
    const body: unknown = await c.req.json().catch(() => ({}))
    const text =
      typeof body === 'object' && body !== null && 'text' in body && typeof body.text === 'string' ? body.text : ''
    if (text.trim().length === 0) {
      return c.json({ error: { message: '入力内容が正しくありません。' } }, 400)
    }

    try {
      const result = await invoke(new 太宰({ apiKey }), text)
      return c.json({ result })
    } catch (e) {
      const error = e as Error
      console.error(`Error with OpenAI API request: ${error.message}`, error)
      return c.json({ error: { message: 'An error occurred during your request.' } }, 500)
    }
  }
