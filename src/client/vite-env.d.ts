/// <reference types="vite/client" />

// ビルド時に埋め込まれる環境変数。VITE_ 接頭辞のものだけがクライアントに露出する
interface ImportMetaEnv {
  // Google タグマネージャーのコンテナ ID（GTM- で始まる）。未設定ならタグを埋め込まない
  readonly VITE_GTM_ID?: string
}
