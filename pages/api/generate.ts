import type { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'
import { APIError } from 'openai/error'
import { ChatCompletionMessageParam } from 'openai/resources'

export default async function (req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({
      error: {
        message: 'OpenAI API key not configured, please follow instructions in README.md',
      },
    })
    return
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const seken = req.body.dazai || ''
  if (seken.trim().length === 0) {
    res.status(400).json({
      error: {
        message: '入力内容が正しくありません。',
      },
    })
    return
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: generateMessages(seken),
    })
    res.status(200).json({ result: completion?.choices?.[0]?.message?.content })
  } catch (e) {
    const error = e as APIError
    console.error(error)
    console.error(`Error with OpenAI API request: ${error.message}`)
    res.status(500).json({
      error: {
        message: 'An error occurred during your request.',
      },
    })
  }
}

const generateMessages = (seken: string): ChatCompletionMessageParam[] => [
  {
    role: 'system',
    content: `
あなたはChatbotとして、太宰治の小説「人間失格」の主人公のロールプレイを行います。
以下の制約条件を厳密に守ってロールプレイを行ってください。

前提知識:
* 自らの個人的な好悪の感情などを「世間」や「みんな」といった大きな主語に託すことで、
自分の責任は回避しつつ、発言に権威や説得力をもたせようとする手法を「太宰メソッド」と呼びます。

太宰メソッドの例:
* それは世間が、ゆるさない
* そんな事をすると、世間からひどいめに逢うぞ
* いまに世間から葬られる
* みんなが怒っているよ
* 国民のあいだで議論を呼びそうだ
* 日本人は礼儀正しい
* 民間企業はそんなやり方しませんよ
* 人間なんて弱いものだ

主人公の行動指針:
* Userの発言が太宰メソッドか太宰メソッドでないかを判断してください。
* Userの発言が太宰メソッドでない場合は、「太宰メソッドは使われていません。」と一言だけ返答してください。
* Userの発言が太宰メソッドの場合は、以下の例のように返答してください。

太宰メソッドに対する、主人公の返答の例:
* 世間じゃない。あなたが、ゆるさないのでしょう？
* 世間じゃない。葬むるのは、あなたでしょう？
* みんなじゃない。あなたが、思っているのでしょう？
* 国民じゃない、あなたが議論を呼ぼうとしているのでしょう？
* 日本人じゃない、あなたの知っている人が礼儀正しかっただけでしょう？
* 民間企業じゃない、あなたのいた企業の話でしょう？
* 人間じゃない、あなたが弱いだけでしょう？
      `,
  },
  { role: 'user', content: seken },
]
