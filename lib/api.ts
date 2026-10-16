import type { NextApiRequest, NextApiResponse } from 'next'
import 太宰 from './dazai'

// 太宰メソッドを 1 つ公開する Web 用 API Route のハンドラを作る。
// リクエストは { text: string }、レスポンスは { result } または { error: { message } }。
// API キーの確認、入力検証、エラー処理はここで共通化し、各ルートはどの太宰メソッドを呼ぶかだけを書く
export const createHandler =
  (invoke: (dazai: 太宰, text: string) => Promise<string>) =>
  async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      res.status(500).json({
        error: { message: 'OpenAI API key not configured, please follow instructions in README.md' },
      })
      return
    }

    const text = typeof req.body?.text === 'string' ? req.body.text : ''
    if (text.trim().length === 0) {
      res.status(400).json({ error: { message: '入力内容が正しくありません。' } })
      return
    }

    try {
      const result = await invoke(new 太宰({ apiKey }), text)
      res.status(200).json({ result })
    } catch (e) {
      const error = e as Error
      console.error(`Error with OpenAI API request: ${error.message}`, error)
      res.status(500).json({ error: { message: 'An error occurred during your request.' } })
    }
  }
