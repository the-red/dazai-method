// Google タグマネージャーのスニペットを <head> に挿入する。
// GA4 の計測タグは GTM 側で設定するので、このコードは GA の測定 ID を知らなくてよい。
// コンテナ ID が無ければ何もしないので、ローカル開発の操作が本番の計測に混ざらない
export const installGtm = (containerId: string | undefined): void => {
  if (!containerId) return

  // Google 公式スニペット相当。dataLayer に gtm.start を積んでから gtm.js を非同期で読み込む
  type DataLayerWindow = Window & { dataLayer?: unknown[] }
  const w = window as DataLayerWindow
  w.dataLayer = w.dataLayer ?? []
  w.dataLayer.push({ 'gtm.start': Date.now(), 'event': 'gtm.js' })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`
  document.head.appendChild(script)
}
