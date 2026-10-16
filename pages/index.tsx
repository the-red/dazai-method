import Head from 'next/head'
import { FormEventHandler, useEffect, useRef, useState } from 'react'
import styles from './index.module.css'
import { BeatLoader } from 'react-spinners'

// LINE チャットボットの友だち追加 URL
// LINE Official Account Manager の「友だち追加ガイド」で作成した
// 経路「太宰メソッドWeb経由の登録」の計測用 URL（分析 > 友だち > 追加経路 で集計される）
const LINE_ADD_FRIEND_URL = 'https://lin.ee/xJvg0TV'

// 変換の向き。decode は太宰メソッドに切り返す（世間→あなた）、encode は本音を世間に託す（あなた→世間）
type Mode = 'decode' | 'encode'

// モードごとの表示と送信先。プレースホルダーは表示のたびにランダムで 1 つ選ぶ
const MODES: Record<Mode, { label: string; endpoint: string; placeholders: string[] }> = {
  decode: {
    label: '世間じゃない',
    endpoint: '/api/decode',
    placeholders: ['それは世間が、ゆるさない', 'そんな事をすると、世間からひどいめに逢うぞ', 'いまに世間から葬られる'],
  },
  encode: {
    label: '世間に託す',
    endpoint: '/api/encode',
    placeholders: ['私は、あの人が嫌いだ', '俺は、残業したくない', 'その服、似合ってないと思う'],
  },
}

const pickPlaceholder = (mode: Mode) => {
  const candidates = MODES[mode].placeholders
  return candidates[Math.floor(Math.random() * candidates.length)]
}

export default function Home() {
  const inputElement = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('decode')
  // サーバー側の HTML とブラウザ側の初回描画を一致させるため、乱数はマウント後に引く
  const [placeholder, setPlaceholder] = useState('')
  useEffect(() => {
    setPlaceholder(pickPlaceholder(mode))
  }, [mode])
  const [dazailInput, setDazaiInput] = useState('')
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)
  // モードを切り替えたら前の結果は意味を失うので消す
  const switchMode = (next: Mode) => {
    if (next === mode) return
    setMode(next)
    setResult('')
    setError('')
    inputElement.current?.focus()
  }
  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault()
    // 空欄のまま送信されたら、表示中のプレースホルダーの文を入力とみなす
    const text = dazailInput.trim() === '' ? placeholder : dazailInput
    if (text === '') return
    setDazaiInput(text)
    try {
      inputElement.current?.select()
      setResult('')
      setError('')
      setLoading(true)
      const response = await fetch(MODES[mode].endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      })

      const data = (await response.json()) as { result: string; error?: Error }
      if (response.status !== 200) {
        throw data.error || new Error(`Request failed with status ${response.status}`)
      }

      setResult(data.result)
    } catch (e) {
      const error = e as Error
      // Consider implementing your own error handling logic here
      console.error(error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Head>
        <title>太宰メソッド</title>
        <link rel="icon" href="/seken.png" />
      </Head>

      {/* 右上の外部リンク */}
      <nav className={styles.links}>
        <a href={LINE_ADD_FRIEND_URL} target="_blank" rel="noreferrer" aria-label="LINE チャットボットを友だち追加">
          {/* LINE アイコン（simple-icons） */}
          <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
          </svg>
        </a>
        <a href="https://github.com/the-red/dazai-method" target="_blank" rel="noreferrer" aria-label="GitHub">
          {/* GitHub 公式マーク（Octicons mark-github） */}
          <svg viewBox="0 0 16 16" width="32" height="32" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </nav>

      <main className={styles.main}>
        <img src="/dazai.webp" alt="太宰メソッド" className={styles.hero} />
        {/* 変換の向きの切り替え */}
        <div className={styles.modes} role="tablist" aria-label="モード">
          {(Object.keys(MODES) as Mode[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={mode === key ? styles.modeActive : undefined}
              onClick={() => switchMode(key)}
            >
              {MODES[key].label}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit}>
          <input
            ref={inputElement}
            type="text"
            name="dazai"
            placeholder={placeholder}
            value={dazailInput}
            onChange={(e) => setDazaiInput(e.target.value)}
            enterKeyHint="send"
          />
          {loading && (
            <BeatLoader
              color="#10a37f"
              cssOverride={{
                justifyContent: 'center',
              }}
              size={20}
            />
          )}
        </form>
        {error ? <div className={styles.error}>{error}</div> : <div className={styles.result}>{result}</div>}
      </main>

      <footer className={styles.footer}>
        <p>
          <a
            href="https://d.hatena.ne.jp/keyword/%E5%A4%AA%E5%AE%B0%E3%83%A1%E3%82%BD%E3%83%83%E3%83%89"
            target="_blank"
            rel="noreferrer"
          >
            What is 太宰メソッド？
          </a>
        </p>
      </footer>
    </div>
  )
}
