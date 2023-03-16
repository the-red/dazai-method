import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
})
const openai = new OpenAIApi(configuration)

export default async function (req, res) {
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
    res.status(200).json({ result: completion.data.choices[0].message.content })
  } catch (error) {
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

const generateMessages = (seken): ChatCompletionRequestMessage[] => [
  {
    role: 'system',
    content: `
      「世間」や「みんな」といった大きな主語に託した発言するに対して、
      「世間じゃない、あなたが」「みんなじゃない、あなたが」と指摘してください。
      返答は必ず一文で、末尾は「でしょう？」というフォーマットにしてください。
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
