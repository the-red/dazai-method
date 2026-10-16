import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources'

// Web（/api/decode, /api/encode）と LINE Webhook（/api/line）で共通のモデル
export const MODEL = 'gpt-6-luna'

// 既定の人格。『人間失格』の主人公（大庭葉蔵）として振る舞う
const DEFAULT_PERSONA = '太宰治の小説「人間失格」の主人公'

// 太宰メソッドが使われていない発言への定型返答。システムプロンプトにも埋め込んで、LLM にこの文言をそのまま返させる
const NOT_DAZAI_METHOD = '太宰メソッドは使われていません。'

// 太宰メソッドの例文と、それに対する主人公の切り返し、そして元になった本音。
// decode() は 例→切り返し、encode() は 本音→例 の向きで few-shot に使う
const EXAMPLES = [
  {
    本音: '私は、ゆるさない',
    太宰メソッド: 'それは世間が、ゆるさない',
    切り返し: '世間じゃない。あなたが、ゆるさないのでしょう？',
  },
  {
    本音: '私は、あなたを葬りたい',
    太宰メソッド: 'いまに世間から葬られる',
    切り返し: '世間じゃない。葬むるのは、あなたでしょう？',
  },
  {
    本音: '私は、怒っている',
    太宰メソッド: 'みんなが怒っているよ',
    切り返し: 'みんなじゃない。あなたが、思っているのでしょう？',
  },
  {
    本音: '私は、これを議論したい',
    太宰メソッド: '国民のあいだで議論を呼びそうだ',
    切り返し: '国民じゃない、あなたが議論を呼ぼうとしているのでしょう？',
  },
  {
    本音: '私の知っている人は、礼儀正しい',
    太宰メソッド: '日本人は礼儀正しい',
    切り返し: '日本人じゃない、あなたの知っている人が礼儀正しかっただけでしょう？',
  },
  {
    本音: '私のいた企業は、そんなやり方をしなかった',
    太宰メソッド: '民間企業はそんなやり方しませんよ',
    切り返し: '民間企業じゃない、あなたのいた企業の話でしょう？',
  },
  { 本音: '私は、弱い', 太宰メソッド: '人間なんて弱いものだ', 切り返し: '人間じゃない、あなたが弱いだけでしょう？' },
] as const

// プロンプトにだけ載せる太宰メソッドの追加例（対応する切り返し・本音は用意していない）
const EXTRA_DAZAI_METHOD_EXAMPLES = ['そんな事をすると、世間からひどいめに逢うぞ']

const bulletList = (items: readonly string[]) => items.map((item) => `* ${item}`).join('\n')

// 全メソッド共通のプロンプト冒頭。人格だけ差し替え可能で、前提知識はクラスが必ず付ける
const buildPreamble = (persona: string) => `
あなたはChatbotとして、${persona}のロールプレイを行います。
以下の制約条件を厳密に守ってロールプレイを行ってください。

前提知識:
* 自らの個人的な好悪の感情などを「世間」や「みんな」といった大きな主語に託すことで、
自分の責任は回避しつつ、発言に権威や説得力をもたせようとする手法を「太宰メソッド」と呼びます。
`

// decode() のシステムプロンプト。行動指針（太宰メソッドでないときの定型文を含む）はクラスが必ず付ける。
// ここまで差し替えられるようにすると、LINE 側の判定に使う定型文が崩れるため
const buildDecodePrompt = (persona: string) => `${buildPreamble(persona)}
太宰メソッドの例:
${bulletList([...EXAMPLES.slice(0, 1).map((e) => e.太宰メソッド), ...EXTRA_DAZAI_METHOD_EXAMPLES, ...EXAMPLES.slice(1).map((e) => e.太宰メソッド)])}

主人公の行動指針:
* Userの発言が太宰メソッドか太宰メソッドでないかを判断してください。
* Userの発言が太宰メソッドでない場合は、「${NOT_DAZAI_METHOD}」と一言だけ返答してください。
* Userの発言が太宰メソッドの場合は、以下の例のように返答してください。

太宰メソッドに対する、主人公の返答の例:
${bulletList(EXAMPLES.map((e) => e.切り返し))}
`

// encode() のシステムプロンプト。本音を太宰メソッドの言い方に変換する
const buildEncodePrompt = (persona: string) => `${buildPreamble(persona)}
主人公の行動指針:
* Userの発言は、Userの個人的な本音です。
* その本音を、「世間」「みんな」「国民」「日本人」などの大きな主語に託した、太宰メソッドの言い方に変換してください。
* 本音の内容そのものは変えず、主語のすり替えだけを行ってください。
* 変換した一文だけを返答してください。説明や前置きは不要です。

変換の例:
${bulletList(EXAMPLES.map((e) => `${e.本音} → ${e.太宰メソッド}`))}
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
  private readonly decodePrompt: string
  private readonly encodePrompt: string

  constructor({ apiKey, model = MODEL, 人格 = DEFAULT_PERSONA }: 太宰の設定) {
    this.openai = new OpenAI({ apiKey })
    this.model = model
    this.decodePrompt = buildDecodePrompt(人格)
    this.encodePrompt = buildEncodePrompt(人格)
  }

  // 太宰メソッド（世間を主語にした発言）を受け取り、主語を本人に戻した主人公の切り返しを得る。
  // 太宰メソッドでなければ NOT_DAZAI_METHOD の文言が返る。失敗時は例外を投げる
  async decode(seken: string): Promise<string> {
    return this.complete(this.decodePrompt, seken)
  }

  // 一人称の本音を受け取り、大きな主語に託した太宰メソッドの言い方に変換する。失敗時は例外を投げる
  async encode(本音: string): Promise<string> {
    return this.complete(this.encodePrompt, 本音)
  }

  // スタンプや画像など、言葉以外を向けられたときの返答
  道化る(): string {
    return '言葉にしていただかないと、わたしには判りかねます。文章で聞かせてください。'
  }

  // 返答の生成に失敗したときの返答
  恥じる(): string {
    return '恥の多い生涯を送って来ました。返答の生成に失敗したのです。しばらくしてからもう一度お試しください。'
  }

  // システムプロンプトと発言を OpenAI に投げ、返答のテキストを返す
  private async complete(systemPrompt: string, text: string): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ]
    const completion = await this.openai.chat.completions.create({ model: this.model, messages })
    const reply = completion.choices[0]?.message?.content?.trim()
    if (!reply) {
      throw new Error('OpenAI returned an empty response')
    }
    return reply
  }
}
