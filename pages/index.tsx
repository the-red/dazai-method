import Head from 'next/head'
import { FormEventHandler, useRef, useState } from 'react'
import styles from './index.module.css'
import { BeatLoader } from 'react-spinners'

export default function Home() {
  const inputElement = useRef<HTMLInputElement>(null)
  const [dazailInput, setDazaiInput] = useState('')
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault()
    try {
      inputElement.current?.select()
      setResult('')
      setError('')
      setLoading(true)
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dazai: dazailInput }),
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

      <a
        href="https://github.com/the-red/dazai-method"
        target="_blank"
        rel="noreferrer"
        aria-label="GitHub"
        className={styles.github}
      >
        {/* GitHub 公式マーク（Octicons mark-github） */}
        <svg viewBox="0 0 16 16" width="32" height="32" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
      </a>

      <main className={styles.main}>
        <img src="/dazai.png" className={styles.icon} />
        <h3>太宰メソッド</h3>
        <form onSubmit={onSubmit}>
          <input
            ref={inputElement}
            type="text"
            name="dazai"
            placeholder="世間がどうしたのですか？"
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
