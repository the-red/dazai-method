const LINE_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_ACCESS_TOKEN')
const OPENAI_APIKEY = PropertiesService.getScriptProperties().getProperty('OPENAI_APIKEY')

function doPost(e) {
  const event = JSON.parse(e.postData.contents).events[0]

  const url = 'https://api.line.me/v2/bot/message/reply'
  const replyToken = event.replyToken
  const text = generateReplyText(event.message.text)

  UrlFetchApp.fetch(url, {
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN,
    },
    method: 'post',
    payload: JSON.stringify({
      replyToken,
      messages: [
        {
          type: 'text',
          text,
        },
      ],
    }),
  })
  return ContentService.createTextOutput(JSON.stringify({ content: 'post ok' })).setMimeType(
    ContentService.MimeType.JSON
  )
}

const generateReplyText = (userMessage) => {
  if (userMessage === undefined) {
    // メッセージ以外(スタンプや画像など)が送られてきた場合
    return '太宰メソッドは使われていません。'
  }

  const requestOptions = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OPENAI_APIKEY,
    },
    payload: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: generateMessages(userMessage),
    }),
  }
  const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', requestOptions)

  const responseText = response.getContentText()
  const json = JSON.parse(responseText)
  const text = json['choices'][0]['message']['content'].trim()
  return text
}

const generateMessages = (seken) => [
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
