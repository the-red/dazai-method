import Head from 'next/head'
import link from 'next/link'
import { type } from 'os'
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
    </div>
  )
}
