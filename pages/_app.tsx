import type { AppProps } from 'next/app'
import { GoogleAnalytics } from '@next/third-parties/google'

// Google Analytics 4 の測定 ID（G- で始まる）。Vercel の環境変数で設定する。
// 未設定ならタグを出さないので、ローカル開発の操作が本番の計測に混ざらない
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      {GA_MEASUREMENT_ID && <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />}
    </>
  )
}
