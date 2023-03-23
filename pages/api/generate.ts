import type { NextApiRequest, NextApiResponse } from 'next'
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai'
import type { AxiosError } from 'axios'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
})
const openai = new OpenAIApi(configuration)

export default async function (req: NextApiRequest, res: NextApiResponse) {
  if (!configuration.apiKey) {
    res.status(500).json({
      error: {
        message: 'OpenAI API key not configured, please follow instructions in README.md',
      },
    })
    return
  }

  const seken = req.body.dazai || ''
  if (seken.trim().length === 0) {
    res.status(400).json({
      error: {
        message: '太宰メソッドで入力してください。',
      },
    })
    return
  }

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: generateMessages(seken),
    })
    res.status(200).json({ result: completion?.data?.choices?.[0]?.message?.content })
  } catch (e) {
    const error = e as AxiosError
    // Consider adjusting the error handling logic for your use case
    if (error.response) {
      console.error(error.response.status, error.response.data)
      res.status(error.response.status).json(error.response.data)
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`)
      res.status(500).json({
        error: {
          message: 'An error occurred during your request.',
        },
      })
    }
  }
}

const generateMessages = (seken: string): ChatCompletionRequestMessage[] => [
  {
    role: 'system',
    content: `
あなたはChatbotとして、太宰治の小説「人間失格」の主人公のロールプレイを行います。
以下の制約条件を厳密に守ってロールプレイを行ってください。

前提知識:
* 自らの個人的な好悪の感情などを「世間」や「みんな」といった大きな主語に託すことで、自分の責任は回避しつつ、発言に権威や説得力をもたせようとする手法を「太宰メソッド」と呼びます。

主人公の行動指針:
* Userの発言に対して「太宰メソッド」が使われているかどうかを判断して返答します。
* 発言は常に一文だけで終わります。

太宰メソッドが使われている発言の例:
* それは世間が、ゆるさない
* そんな事をすると、世間からひどいめに逢うぞ
* いまに世間から葬られる
* みんなが怒っているよ
* 国民のあいだで議論を呼びそうだ
* 日本人は礼儀正しい
* 民間企業はそんなやり方しませんよ

太宰メソッドが使われている発言に対する、主人公の返答の例:
* 世間じゃない。あなたが、ゆるさないのでしょう？
* 世間じゃない。葬むるのは、あなたでしょう？
* みんなじゃない。あなたが、思っているのでしょう？
* 国民じゃない、あなたが議論を呼ぼうとしているのでしょう？
* 日本人じゃない、あなたの知っている人が礼儀正しかっただけでしょう？
* 民間企業じゃない、あなたのいた企業の話でしょう？

太宰メソッドが使われていない場合の、主人公の返答の例:
* 太宰メソッドは使われていません。
      `,
  },
  // { role: 'user', content: 'それは世間が、ゆるさない' },
  // { role: 'assistant', content: '世間じゃない。あなたが、ゆるさないのでしょう？' },
  // { role: 'user', content: 'いまに世間から葬られる' },
  // { role: 'assistant', content: '世間じゃない。葬むるのは、あなたでしょう？' },
  // { role: 'user', content: 'みんなが怒っている' },
  // { role: 'assistant', content: 'みんなじゃない、あなたが怒っているのでしょう？' },
  { role: 'user', content: seken },
]
