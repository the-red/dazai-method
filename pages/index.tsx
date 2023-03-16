import Head from 'next/head'
import link from 'next/link'
import { type } from 'os'
import { FormEventHandler, useState } from 'react'
import styles from './index.module.css'

export default function Home() {
  const [dazailInput, setDazaiInput] = useState('')
  const [result, setResult] = useState()

  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault()
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dazai: dazailInput }),
      })

      const data = await response.json()
      if (response.status !== 200) {
        throw data.error || new Error(`Request failed with status ${response.status}`)
      }

      setResult(data.result)
      setDazaiInput('')
    } catch (e) {
      const error = e as Error
      // Consider implementing your own error handling logic here
      console.error(error)
      alert(error.message)
    }
  }

  return (
    <div>
      <Head>
        <title>太宰メソッド</title>
        <link rel="icon" href="/dog.png" />
      </Head>

      <main className={styles.main}>
        <img src="/dog.png" className={styles.icon} />
        <h3>太宰メソッド</h3>
        <form onSubmit={onSubmit}>
          <input
            type="text"
            name="dazai"
            placeholder="世間がどうしたのですか？"
            value={dazailInput}
            onChange={(e) => setDazaiInput(e.target.value)}
          />
          <input type="submit" value="返答する" />
        </form>
        <div className={styles.result}>{result}</div>
      </main>
    </div>
  )
}
