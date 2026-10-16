import type { AppProps } from 'next/app'
import { GoogleTagManager } from '@next/third-parties/google'

// Google タグマネージャーのコンテナ ID（GTM- で始まる）。Vercel の環境変数で設定する。
// GA4 の計測タグは GTM 側で設定するので、このコードは GA の測定 ID を知らなくてよい。
// 未設定ならタグを出さないので、ローカル開発の操作が本番の計測に混ざらない
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      {GTM_ID && <GoogleTagManager gtmId={GTM_ID} />}
    </>
  )
}
