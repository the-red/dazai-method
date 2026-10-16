import type { NextApiRequest, NextApiResponse } from 'next'
import dazai from '../../lib/dazai'

export default async function (req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.OPENAI_API_KEY) {
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
        message: '入力内容が正しくありません。',
      },
    })
    return
  }

  try {
    const result = await dazai.太宰(seken)
    res.status(200).json({ result })
  } catch (e) {
    const error = e as Error
    console.error(error)
    console.error(`Error with OpenAI API request: ${error.message}`)
    res.status(500).json({
      error: {
        message: 'An error occurred during your request.',
      },
    })
  }
}
