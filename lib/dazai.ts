import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources'

// Web（/api/generate）と LINE Webhook（/api/line）で共通のモデル
export const MODEL = 'gpt-6-luna'

// 既定の人格。『人間失格』の主人公（大庭葉蔵）として振る舞う
const DEFAULT_PERSONA = '太宰治の小説「人間失格」の主人公'

// 太宰メソッドが使われていない発言への定型返答。システムプロンプトにも埋め込んで、LLM にこの文言をそのまま返させる
const NOT_DAZAI_METHOD = '太宰メソッドは使われていません。'

// プロンプトに載せる太宰メソッドの例文。例を挙げる() もこれを返す
const DAZAI_METHOD_EXAMPLES = [
  'それは世間が、ゆるさない',
  'そんな事をすると、世間からひどいめに逢うぞ',
  'いまに世間から葬られる',
  'みんなが怒っているよ',
  '国民のあいだで議論を呼びそうだ',
  '日本人は礼儀正しい',
  '民間企業はそんなやり方しませんよ',
  '人間なんて弱いものだ',
]

// 上の例文それぞれに対する、主人公の切り返しの例
const RETORT_EXAMPLES = [
  '世間じゃない。あなたが、ゆるさないのでしょう？',
  '世間じゃない。葬むるのは、あなたでしょう？',
  'みんなじゃない。あなたが、思っているのでしょう？',
  '国民じゃない、あなたが議論を呼ぼうとしているのでしょう？',
  '日本人じゃない、あなたの知っている人が礼儀正しかっただけでしょう？',
  '民間企業じゃない、あなたのいた企業の話でしょう？',
  '人間じゃない、あなたが弱いだけでしょう？',
]

const bulletList = (items: readonly string[]) => items.map((item) => `* ${item}`).join('\n')

// システムプロンプト。人格だけ差し替え可能で、前提知識・例文・行動指針（聞き流す文言を含む）はクラスが必ず付ける。
// 行動指針まで差し替えられるようにすると、LINE 側の判定に使う定型文が崩れるため
const buildSystemPrompt = (persona: string) => `
あなたはChatbotとして、${persona}のロールプレイを行います。
以下の制約条件を厳密に守ってロールプレイを行ってください。

前提知識:
* 自らの個人的な好悪の感情などを「世間」や「みんな」といった大きな主語に託すことで、
自分の責任は回避しつつ、発言に権威や説得力をもたせようとする手法を「太宰メソッド」と呼びます。

太宰メソッドの例:
${bulletList(DAZAI_METHOD_EXAMPLES)}

主人公の行動指針:
* Userの発言が太宰メソッドか太宰メソッドでないかを判断してください。
* Userの発言が太宰メソッドでない場合は、「${NOT_DAZAI_METHOD}」と一言だけ返答してください。
* Userの発言が太宰メソッドの場合は、以下の例のように返答してください。

太宰メソッドに対する、主人公の返答の例:
${bulletList(RETORT_EXAMPLES)}
`

export type 太宰の設定 = {
  // OpenAI の API キー。クラスの中で環境変数は読まず、呼び出し側が確認して渡す
  apiKey: string
  // 使用モデル。省略時は MODEL
  model?: string
  // ロールプレイする人格。省略時は『人間失格』の主人公
  人格?: string
}

// 太宰クラス。このクラスが提供するメソッドを総称して「太宰メソッド」と呼ぶ。
// 「太宰メソッド」の名にちなんだ意図的な日本語識別子で、namespace や単なるオブジェクトではなくクラスにしていることも意図的。
// 人格はコンストラクタで決まり、生成後は変わらない（setter は設けない）。
export default class 太宰 {
  private readonly openai: OpenAI
  private readonly model: string
  private readonly systemPrompt: string

  constructor({ apiKey, model = MODEL, 人格 = DEFAULT_PERSONA }: 太宰の設定) {
    this.openai = new OpenAI({ apiKey })
    this.model = model
    this.systemPrompt = buildSystemPrompt(人格)
  }

  // 世間を主語にした発言を受け取り、OpenAI に問い合わせて主人公の切り返しを得る。失敗時は例外を投げる
  async 切り返す(seken: string): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: this.messages(seken),
    })
    const text = completion.choices[0]?.message?.content?.trim()
    if (!text) {
      throw new Error('OpenAI returned an empty response')
    }
    return text
  }

  // 太宰メソッドが使われていない発言への定型返答
  聞き流す(): string {
    return NOT_DAZAI_METHOD
  }

  // スタンプや画像など、言葉以外を向けられたときの返答
  道化る(): string {
    return '言葉にしていただかないと、わたしには判りかねます。文章で聞かせてください。'
  }

  // 返答の生成に失敗したときの返答
  恥じる(): string {
    return '恥の多い生涯を送って来ました。返答の生成に失敗したのです。しばらくしてからもう一度お試しください。'
  }

  // プロンプトに載せている太宰メソッドの例文
  例を挙げる(): string[] {
    return [...DAZAI_METHOD_EXAMPLES]
  }

  private messages(seken: string): ChatCompletionMessageParam[] {
    return [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: seken },
    ]
  }
}
