import Head from 'next/head'
import { FormEventHandler, useRef, useState } from 'react'
import styles from './index.module.css'
import { BeatLoader } from 'react-spinners'

const Ads = () => (
  <>
    <a href="https://px.a8.net/svt/ejp?a8mat=3T4O7H+N7XDE+CO4+15XK4X" rel="nofollow noopener" target="_blank">
      <img
        width="234"
        height="60"
        alt=""
        src="https://www25.a8.net/svt/bgt?aid=230325389039&wid=001&eno=01&mid=s00000001642007043000&mc=1"
      />
    </a>
    <img width="1" height="1" src="https://www12.a8.net/0.gif?a8mat=3T4O7H+N7XDE+CO4+15XK4X" alt="" />
  </>
)

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
        <Ads />
      </footer>
    </div>
  )
}
