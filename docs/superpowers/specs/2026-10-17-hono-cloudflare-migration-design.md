# 設計: Next.js / Vercel から Hono / Cloudflare Workers へ移行する

日付: 2026-10-17

## 意図と背景

Vercel の Hobby プランは広告掲載を商用利用とみなして禁止しているため、広告を出せる無料ホスティングへ移す。
Cloudflare Workers の無料プランは規約に非商用・広告禁止の条項がなく、`the-red.app` の DNS が既に Cloudflare 管理なので
カスタムドメインも追加コストなしで使える。

このアプリは 1 ページ + API 3 本で、Next.js 固有の機能はほぼ使っていない。Next.js のまま Workers に載せると
OpenNext アダプタ、Worker サイズ上限、バージョン追従といった余計なリスクを抱えるので、
サーバー側を Workers ネイティブの Hono に書き換え、Next.js を捨てる。

## ゴール

- `https://dazai-method.the-red.app` で Web アプリが動き、`https://dazai-method.the-red.app/api/line` で LINE Webhook が動く。
- `main` ブランチへ push すると Cloudflare 側で自動ビルド・自動デプロイされる（Vercel と同じ運用感）。
- Web と LINE の振る舞い、API のリクエスト／レスポンス形式、画面の見た目と操作感は移行前と同じ。
- OpenAI API キーと LINE のチャネルシークレット／アクセストークンは Worker の中だけに存在し、クライアントには届かない。
- 切り替え完了と同時に Vercel プロジェクトを削除する。

## やらないこと

- `lib/dazai.ts` の `太宰` クラス（プロンプト、モデル、メソッド名、設計方針）には手を触れない。
  CLAUDE.md の「太宰メソッド」の設計制約はそのまま有効。
- UI の見た目やレイアウトの変更、新機能の追加。
- 旧 URL（`dazai-method.vercel.app`）からのリダイレクト。転送期間は設けない。
- Cloudflare Pages は使わない（維持モードのため）。
- `workers.dev` の既定 URL での公開（無効化する）。
- 広告の実装そのもの。今回はホスティングの移行だけ。

## 失敗とみなすこと

- 署名検証なしで LINE Webhook が動いてしまう、または署名検証をすり抜ける経路がある。
- API キーやシークレットがクライアントのバンドルやレスポンスに混入する。
- `太宰` クラスが英語化・関数化・namespace 化される。
- LINE の返信が OpenAI の応答待ちでタイムアウトする（Workers は HTTP リクエストの実行時間に上限がないので、起きないはず）。

## 制約

- Cloudflare Workers 無料プラン。1 日 10 万リクエスト、1 リクエストあたり CPU 10ms（fetch の待ち時間は含まない）、
  Worker の圧縮サイズ 3MiB。
- パッケージマネージャは yarn 1（classic）。Node は 24 系（`.tool-versions` と `package.json` の `engines`）。
- Prettier 設定（`.prettierrc.yaml`）はそのまま。整形対象ディレクトリは新構成に合わせて変える。
- `@line/bot-sdk` の `validateSignature` は Node の `crypto` を使うので、Worker の互換フラグ `nodejs_compat` を有効にする。
- コミュニケーション、コードコメント、設計書は日本語。

## 決まっていること（利用者の決定）

| 項目 | 決定 |
|---|---|
| 行き先 | Cloudflare Workers 無料プラン |
| サーバー側 | Hono で書き直し、Next.js は削除 |
| 画面側 | React のまま。Vite でビルドして静的アセットとして配信 |
| 本番 URL | `https://dazai-method.the-red.app`（カスタムドメイン。`the-red.app` のゾーンは Worker と同じ Cloudflare アカウントで DNS 管理済み。同名の既存 DNS レコードはない） |
| デプロイ | GitHub 連携で push 時に自動（Workers Builds） |
| 旧 URL | 切り替えと同時に Vercel プロジェクトを削除。転送なし |
| 作業ブランチ | `v2` のまま進める。移行コミットは `v2` に積み、encode / decode と移行をまとめて `main` に入れる。`v2` 単体を Vercel でリリースする工程は設けない |

## 設計（私の判断。違っていれば指摘してほしい）

### 土台にするブランチ

移行作業は `v2` ブランチ（encode / decode API と新メソッド名を含む。`main` より 6 コミット先行、未マージ）を土台にする。
本設計書で「移行前と同一」と言う API 契約とメソッド名は `v2` のものを指す。
`v2` は Vercel には出さず、移行とまとめて `main` に入れる（利用者の決定）。したがって Vercel 本番は
旧 API（`/api/generate`）のまま、Cloudflare の新 API に一気に切り替わる。切り替え後の動作確認は
`v2` をローカルで動かした結果と比べる。

### リポジトリ構成

同じリポジトリの中で置き換える。別リポジトリにはしない。

```
index.html                  Vite のエントリ HTML（旧 next/head と _app.tsx の内容をここに）
src/
  client/
    main.tsx                React のマウント
    App.tsx                 旧 pages/index.tsx のコンポーネント（ロジックはほぼそのまま）
    index.module.css        旧 pages/index.module.css（無変更）
  server/
    index.ts                Hono アプリ本体。ルーティングと fetch ハンドラの export
    api.ts                  旧 lib/api.ts。太宰メソッドを 1 つ公開するハンドラを作る共通処理
    line.ts                 旧 pages/api/line.ts。LINE Webhook
lib/
  dazai.ts                  無変更
public/                     robots.txt、sitemap.xml、画像（Search Console の確認ファイルは削除。後述）
wrangler.jsonc              Worker の設定
vite.config.ts              Vite + React プラグイン + Cloudflare Vite プラグイン
.dev.vars.example           ローカル用シークレットの雛形（旧 .env.example の後継）
```

削除するもの: `pages/` 一式、`next-env.d.ts`（既に git 管理外）、`.env.example`、
依存の `next` と `@next/third-parties`。

`lib/dazai.ts` は `lib/` に残す。サーバー専用のモジュールだが、CLAUDE.md が `lib/dazai.ts` を前提に書かれており、
移動する理由がない。

### ビルドと開発サーバー

- Cloudflare 公式の `@cloudflare/vite-plugin` を使い、Hono の Worker と React の画面を 1 つの Vite プロジェクトで扱う。
  `vite dev` で画面と API が同時に立ち上がり、`vite build` で Worker 本体と静的アセットが分かれて出力される。
- `vite.config.ts` のプラグインは `@vitejs/plugin-react` と `@cloudflare/vite-plugin` の 2 つ。
- `package.json` の scripts は `dev`（vite）、`build`（vite build）、`preview`（vite preview）、
  `deploy`（`wrangler deploy`。手動デプロイが必要になったときの保険）、`format`、`typecheck`（tsc）に整理する。
  `start` は不要になるので消す。
- 型チェックはビルドに含まれないので `yarn typecheck` を別に用意し、CLAUDE.md にその旨を書く。
- `tsconfig.json` はクライアントとサーバーで `lib` が異なるため、ルートの `tsconfig.json` から
  `src/client` 用と `src/server` 用に分ける。分け方の詳細は実装者に任せる。
- Workers Builds は `yarn.lock` から yarn を自動検出する。Node のバージョンは `package.json` の `engines` または
  `.node-version` から読むので、`.tool-versions` と同じ 24 系を指す `.node-version` を置く。

### Worker の設定（wrangler.jsonc）

- `name`: `dazai-method`
- `main`: `src/server/index.ts`
- `compatibility_date`: 実装時点の日付
- `compatibility_flags`: `["nodejs_compat"]`
- `assets`: Vite の出力先を静的アセットとして配信する。リクエストがアセットに一致すればアセットが返り、
  一致しなければ Worker に渡る（既定の挙動）。`/api/*` にはアセットがないので Worker に届く。
- `workers_dev`: `false`（`workers.dev` の既定 URL を無効化）
- `routes`: `dazai-method.the-red.app` をカスタムドメインとして指定（`custom_domain: true`）。
  DNS レコードと証明書は Cloudflare が自動で作る。
- `observability` のログは有効にする（無料枠内）。

### 秘密情報と環境変数

| 名前 | 置き場所 | 用途 |
|---|---|---|
| `OPENAI_API_KEY` | Worker のシークレット | OpenAI 呼び出し |
| `LINE_CHANNEL_SECRET` | Worker のシークレット | Webhook の署名検証 |
| `LINE_CHANNEL_ACCESS_TOKEN` | Worker のシークレット | LINE への返信 |
| `VITE_GTM_ID` | Workers Builds のビルド時変数 | GTM コンテナ ID。画面のバンドルに埋め込まれる |

- サーバー側は `process.env` ではなく Hono の `c.env` から読む。`Bindings` 型を `src/server` で定義する。
- ローカルでは `.dev.vars` にシークレットを書く（git 管理外。`.gitignore` に追加）。`.dev.vars.example` を雛形として置く。
- `VITE_GTM_ID` は旧 `NEXT_PUBLIC_GTM_ID` の後継。Vite の仕様で `VITE_` 接頭辞のものだけがクライアントに露出する。
  ローカルは未設定のままにして、開発中の操作が本番の計測に混ざらないようにする（今と同じ）。

### API の契約（移行前と同一）

- `POST /api/decode` と `POST /api/encode`: リクエスト `{ text: string }`、
  成功時 `200 { result: string }`、入力不正 `400 { error: { message } }`、
  キー未設定または OpenAI 失敗 `500 { error: { message } }`。メッセージ文字列も現行のまま。
- `POST /api/line`: LINE Messaging API の Webhook。ステータスの使い分けも現行のまま
  （405、500 設定不備、401 署名なし／不一致、413 ボディ過大、400 JSON 不正、200 `{ ok: true }`）。
- 上記以外のパスで Worker に届いたものは 404。

### Hono 側の実装方針

- `src/server/api.ts` の共通処理は、現行 `createHandler` の構造（キー確認、入力検証、`太宰` 呼び出し、エラー処理）を保ち、
  引数を `NextApiRequest/Response` から Hono のコンテキストに変える。
- `src/server/line.ts` は現行の処理順を保つ。Node のストリーム処理（`req.on('data')`）は
  `c.req.arrayBuffer()` に置き換え、`Buffer.from` で `validateSignature` に渡す。
  1MiB の上限は `Content-Length` ヘッダーの事前チェックで維持する。ストリーム途中での打ち切りは Workers では不要。
- `maxDuration` と `bodyParser: false` の設定は不要になるので消す。
- `@line/bot-sdk` の `MessagingApiClient` は fetch ベースなのでそのまま使う。
- OpenAI SDK も fetch ベースなのでそのまま使う。

### 画面側の実装方針

- `pages/index.tsx` のコンポーネントとロジックをそのまま `src/client/App.tsx` に移す。
  `next/head` の `<title>` と `<meta>` は `index.html` に書く。
- プレースホルダーをマウント後に引いている `useEffect` は SSR の整合性のためのものだったが、
  動作は変わらないので触らない。
- `react-spinners` と CSS Modules はそのまま。
- GTM は `@next/third-parties` をやめ、Google 公式のスニペットを `index.html` に書き、
  コンテナ ID を `%VITE_GTM_ID%`（Vite の HTML 環境変数置換）で差し込む。
  未設定のときはスニペットを出さない。この条件分岐は `index.html` では書けないので、
  `main.tsx` でスニペット相当のスクリプトを動的に挿入する方式でよい。どちらにするかは実装者に任せる。

### テスト

リポジトリにはテストの仕組みがないが、Hono は `app.request()` でハンドラを直接呼べるので、
vitest を入れて `src/server` の API 契約だけ検証する。対象は次の 4 点に絞る。

- `/api/decode` と `/api/encode` が `{ text }` を受けて `{ result }` を返す（`太宰` はモックする）
- 空入力が 400 になる
- `/api/line` が署名なしで 401、署名不一致で 401 になる
- `/api/line` が正しい署名の Webhook 検証リクエスト（ダミー replyToken）に 200 を返す

画面側のテストは書かない。

### 切り替え手順（実装後の運用作業）

1. Cloudflare ダッシュボードで Workers Builds を使い、GitHub の `the-red/dazai-method` を接続して Worker を作る。
   本番ブランチは `main`。ビルドコマンドは `yarn build`、デプロイコマンドは `wrangler deploy`。
2. Worker のシークレット 3 つと、ビルド時変数 `VITE_GTM_ID` を設定する。
3. 移行ブランチをデプロイし、Workers Builds のプレビュー URL で画面と `/api/decode` を確認する。
   （プレビュー URL は `workers.dev` 配下に出る。本番は `workers_dev: false` でも、プレビューには影響しない。
   もし出なければ一時的に `workers_dev: true` にして確認し、確認後に戻す。）
4. `main` にマージして本番デプロイ。`https://dazai-method.the-red.app` で画面と API を確認する。
5. LINE Developers コンソールの Webhook URL を `https://dazai-method.the-red.app/api/line` に変え、「検証」ボタンで 200 を確認。
   実際にトークで 1 往復して返信を確認する。
6. Search Console で `https://dazai-method.the-red.app/` の URL プレフィックス型プロパティを追加し、
   HTML タグ方式で所有権を確認する。サイトマップを再送信する。
7. Vercel のプロジェクトを削除する。
8. GTM のトリガーや GA4 のデータストリームにホスト名条件があれば新ホスト名に変える（利用者が確認する）。

手順 1、2、5、6、7、8 はダッシュボード操作なので利用者が行う。コードと設定ファイルは実装者が用意する。

手順 5 で LINE の「検証」が 4xx やチャレンジ応答で失敗した場合は、`the-red.app` ゾーンの Bot Fight Mode や
WAF マネージドルールが LINE プラットフォームからの POST を署名検証より手前で弾いている可能性がある。
その場合は `dazai-method.the-red.app/api/*` を対象にした WAF のスキップルールをゾーン側に追加する（利用者のダッシュボード操作）。
Vercel にはなかった層なので、切り替え時に意識しておく。

### Search Console の確認方式を HTML タグ方式に変える（私の判断）

Workers の静的アセット配信は既定で `/foo.html` を `/foo` にリダイレクトする。Google の HTML ファイル方式はリダイレクトを
受け付けないので、確認ファイル `public/google8375f6c0c9e2d40f.html` は新環境では使えない。
旧 URL のプロパティは URL が変わる時点で捨てるので、連続性を保つ理由もない。

代わりに `index.html` の `<head>` に `<meta name="google-site-verification" content="...">` を書く HTML タグ方式にする。
content の値は Search Console が新プロパティ作成時に表示するものを利用者が実装者に渡す。
値が手に入るまでは meta タグを書かずに進め、切り替え手順 6 の時点で追加してデプロイする。
確認ファイル `public/google8375f6c0c9e2d40f.html` は削除する。

### ドキュメントの更新

- `README.md`: 旧 URL を新 URL に置換。セットアップ手順（`.dev.vars`、`yarn dev`）、デプロイの説明を更新。
- `public/sitemap.xml` と `public/robots.txt`: 旧 URL を新 URL に置換。
- `CLAUDE.md`: 概要、コマンド、アーキテクチャ、運用上の前提を新構成で書き直す。
  現行の CLAUDE.md は `太宰` クラスのメソッド名が古いまま（`切り返す` 等）なので、
  実際のメソッド名（`decode`、`encode`、`guide`、`failed`）に合わせて直す。

## 実装者に任せること

- `tsconfig.json` の分け方
- GTM スニペットを `index.html` に書くか `main.tsx` で動的挿入するか
- vitest の設定と `太宰` のモック方法
- `compatibility_date` の具体的な日付
- `.node-version` の具体値（24 系の範囲で）
- コミットの分割
