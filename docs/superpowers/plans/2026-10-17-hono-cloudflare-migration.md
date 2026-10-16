# Hono / Cloudflare Workers 移行 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js / Vercel で動いている太宰メソッドの Web アプリと LINE Webhook を、Hono + React(Vite) の構成にして Cloudflare Workers で動くようにする。

**Architecture:** サーバー側は Hono アプリ 1 つ（`src/server`）で `/api/decode`、`/api/encode`、`/api/line` を受け、`lib/dazai.ts` の `太宰` クラスを無変更で呼ぶ。画面側は React を Vite でビルドして Workers の静的アセットとして配信する。Cloudflare 公式の Vite プラグインで両者を 1 つの Vite プロジェクトにまとめ、`vite build` の出力を `wrangler deploy` で上げる。

**Tech Stack:** Hono 4.13、Vite 8、@vitejs/plugin-react 6、@cloudflare/vite-plugin 1.64、wrangler 4.151、vitest 5、React 19、TypeScript 7、yarn 1、Node 24

**Spec:** `docs/superpowers/specs/2026-10-17-hono-cloudflare-migration-design.md`

## Global Constraints

- 作業ブランチは `v2`。コミットはすべて `v2` に積む。
- `lib/dazai.ts` には手を触れない。`太宰` クラスの名前・メソッド名（`decode`、`encode`、`guide`、`failed`）・設計方針はそのまま。
- コードコメントと設計・計画文書は日本語。コミットメッセージは既存の流儀（`feat:` / `refactor:` / `chore:` / `docs:` + 日本語）。
- コミットメッセージ末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` を付ける。
- Prettier 設定（`.prettierrc.yaml`: セミコロンなし、シングルクォート、printWidth 120、quoteProps consistent）に従う。
- パッケージマネージャは yarn 1（classic）。Node は 24 系。
- Workers 無料プランの範囲: CPU 10ms/リクエスト、Worker 圧縮サイズ 3MiB。
- Worker の互換フラグ `nodejs_compat` を有効にする（`@line/bot-sdk` の `validateSignature` が `node:crypto` を使うため）。
- API の契約（パス、リクエスト／レスポンスの形、エラーメッセージ文字列、ステータスコード）は設計書「API の契約」のとおり移行前と同一。
- 秘密情報は `process.env` ではなく Hono の `c.env` から読む。クライアントのバンドルに `VITE_` 接頭辞のない値は入らない。

## Review Focus

- `/api/decode` に JSON として壊れたボディを送ったとき、500 ではなく 400 `入力内容が正しくありません。` が返る（Task 1 のテスト）。
- `text` が文字列でない（数値や配列）とき 400 になる（Task 1 のテスト）。
- `/api/line` に `Content-Length` ヘッダーなしで 1MiB を超えるボディが来たとき、読み終えた時点で 413 になる（Task 2 のテスト）。
- 1 回の Webhook に複数イベントがあり、1 件の返信で LINE API が失敗しても、他のイベントには返信され 200 が返る（Task 2 のテスト）。
- 存在しないパス（`/api/nope`、`/nope`）が `index.html` にフォールバックせず 404 になる（Task 1 のテストと Task 3 の確認手順）。

---

### Task 1: Hono アプリと decode / encode API

Next.js と並行して `src/server` に Hono アプリを作り、vitest で API 契約を検証できる状態にする。この時点では Next.js はまだ動く。

**Files:**
- Create: `src/server/bindings.ts`
- Create: `src/server/api.ts`
- Create: `src/server/index.ts`
- Create: `src/server/api.test.ts`
- Create: `vitest.config.ts`
- Create: `tsconfig.server.json`
- Modify: `package.json`（依存とスクリプト）

**Interfaces:**
- Consumes: `lib/dazai.ts` の `default class 太宰`（`new 太宰({ apiKey })`、`decode(text): Promise<string>`、`encode(text): Promise<string>`）
- Produces:
  - `src/server/bindings.ts`: `export type Bindings = { OPENAI_API_KEY?: string; LINE_CHANNEL_SECRET?: string; LINE_CHANNEL_ACCESS_TOKEN?: string }` と `export type AppEnv = { Bindings: Bindings }`（Hono の `Env` 型と混同しないよう別名にする）
  - `src/server/api.ts`: `export const createHandler = (invoke: (dazai: 太宰, text: string) => Promise<string>): Handler<AppEnv>`
  - `src/server/index.ts`: `const app = new Hono<AppEnv>()` に `/api/decode` と `/api/encode` を `app.post` で登録し、`export default app`。Task 2 がここに `/api/line` を追加する。

- [ ] **Step 1: 依存を追加し、テストの土台を作る**

```bash
yarn add hono
yarn add -D vitest @cloudflare/workers-types
```

`package.json` の scripts に `"test": "vitest run"` と `"typecheck": "tsc -p tsconfig.server.json"` を追加する（`typecheck` は Task 3 でクライアント分も足す）。

`vitest.config.ts` は `defineConfig({ test: { environment: 'node', include: ['src/server/**/*.test.ts'] } })` とする。Cloudflare の Vite プラグインは入れない（テストは Node で `app.request()` を直接呼ぶ）。

`tsconfig.server.json` は現行 `tsconfig.json` の `compilerOptions` を引き継ぎ、`lib` を `["esnext"]`、`types` を `["@cloudflare/workers-types", "node"]`、`include` を `["src/server", "lib"]` にする。`jsx` は不要。

- [ ] **Step 2: 失敗するテストを書く**

`src/server/api.test.ts`。`太宰` は `vi.hoisted` で用意した `decodeMock` / `encodeMock` を持つクラスで `vi.mock('../../lib/dazai', ...)` する。`ENV = { OPENAI_API_KEY: 'test-key' }`。

```ts
test('POST /api/decode は 太宰.decode の結果を返す', async () => {
  decodeMock.mockResolvedValue('世間じゃない。あなたが、ゆるさないのでしょう？')
  const res = await app.request('/api/decode', post({ text: 'それは世間が、ゆるさない' }), ENV)
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ result: '世間じゃない。あなたが、ゆるさないのでしょう？' })
  expect(decodeMock).toHaveBeenCalledWith('それは世間が、ゆるさない')
})
test('POST /api/encode は 太宰.encode を呼ぶ', ...)  // encodeMock が text で呼ばれ、200 { result }
test('空文字の text は 400', ...)                    // { text: '   ' } → 400 { error: { message: '入力内容が正しくありません。' } }
test('text が文字列でなければ 400', ...)             // { text: 123 } と {} の両方 → 400、同じメッセージ
test('JSON として壊れたボディは 400', ...)           // body '{bad' → 400、同じメッセージ
test('OPENAI_API_KEY が無ければ 500', ...)           // env {} → 500 { error: { message: 'OpenAI API key not configured, please follow instructions in README.md' } }
test('太宰 が例外を投げたら 500', ...)               // decodeMock.mockRejectedValue → 500 { error: { message: 'An error occurred during your request.' } }
test('未知のパスは 404', ...)                        // GET /api/nope と GET /nope → 404
```

`post(body)` は `{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }` を返すヘルパー。壊れた JSON のケースだけ `body` に生文字列を渡す。

- [ ] **Step 3: テストが失敗することを確認する**

Run: `yarn test`
Expected: FAIL（`src/server/index` が無い）

- [ ] **Step 4: `src/server/bindings.ts`、`src/server/api.ts`、`src/server/index.ts` を実装する**

`createHandler` は現行 `lib/api.ts` の処理順（キー確認 → 入力検証 → `太宰` 呼び出し → エラー処理）とメッセージ文字列をそのまま保つ。ボディは `c.req.json()` の失敗を空オブジェクト扱いにして `text` の検証に落とす。`index.ts` は `app.post('/api/decode', createHandler((dazai, text) => dazai.decode(text)))` と encode の 2 行。未知のパスは Hono の既定で 404。

- [ ] **Step 5: テストと型チェックが通ることを確認する**

Run: `yarn test && yarn typecheck`
Expected: 8 件 PASS、tsc エラーなし

- [ ] **Step 6: コミット**

```bash
git add package.json yarn.lock vitest.config.ts tsconfig.server.json src/server
git commit -m "feat: Hono で decode / encode API を実装し、vitest で API 契約を検証する"
```

---

### Task 2: LINE Webhook を Hono に移植

**Files:**
- Create: `src/server/line.ts`
- Create: `src/server/line.test.ts`
- Modify: `src/server/index.ts`

**Interfaces:**
- Consumes: Task 1 の `AppEnv`、`app`。`@line/bot-sdk` の `validateSignature(body: string | Buffer, channelSecret, signature): boolean`、`messagingApi.MessagingApiClient`、`webhook.CallbackRequest` / `webhook.MessageContent`
- Produces: `src/server/line.ts` の `export const handleLineWebhook: Handler<AppEnv>`。`index.ts` で `app.all('/api/line', handleLineWebhook)` として登録（メソッド判定はハンドラが行い、POST 以外は 405 を返す）。

- [ ] **Step 1: 失敗するテストを書く**

`src/server/line.test.ts`。`太宰` のモックは Task 1 と同じ形に `guide()` と `failed()` の実装（文字列は `lib/dazai.ts` と同じ）を足す。`@line/bot-sdk` は `vi.mock` の `importOriginal` で `validateSignature` と `webhook` を本物のまま残し、`messagingApi.MessagingApiClient` だけ `replyMessage = replyMock` を持つクラスに差し替える。署名は `createHmac('sha256', SECRET).update(body).digest('base64')` で作る。`ENV = { OPENAI_API_KEY: 'k', LINE_CHANNEL_SECRET: SECRET, LINE_CHANNEL_ACCESS_TOKEN: 't' }`。`signedPost(body: string)` は `X-Line-Signature` を付けた POST の init を返すヘルパー。

```ts
test('POST 以外は 405 で Allow: POST', ...)            // GET → 405、header Allow === 'POST'
test('環境変数が欠けていれば 500', ...)                 // env から LINE_CHANNEL_SECRET を抜く → 500
test('署名ヘッダーが無ければ 401', ...)
test('署名が一致しなければ 401', ...)                   // 署名を 'bad' にする
test('1MiB を超えるボディは 413', ...)                  // 'a'.repeat(1024 * 1024 + 1) に正しい署名を付けても 413
test('署名が正しくても JSON でなければ 400', ...)       // body '{bad' に正しい署名
test('Webhook 検証のダミー replyToken には返信しない', ...)
  // events: [{ type: 'message', replyToken: '00000000000000000000000000000000', message: { type: 'text', text: 'x' } }]
  // → 200 { ok: true }、replyMock 未呼び出し
test('テキストメッセージには decode の結果を返信する', ...)
  // decodeMock → 'A'、replyMock が { replyToken: 'tok', messages: [{ type: 'text', text: 'A' }] } で呼ばれる
test('テキスト以外には guide() の文言を返信する', ...)   // message.type 'sticker' → text が guide() の文字列
test('decode が失敗したら failed() の文言を返信する', ...)
test('複数イベントのうち 1 件の返信が失敗しても他は返信され 200', ...)
  // events 2 件、replyMock を 1 回目だけ reject → replyMock 2 回呼び出し、200
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `yarn test src/server/line.test.ts`
Expected: FAIL（`./line` が無い）

- [ ] **Step 3: `src/server/line.ts` を実装し、`index.ts` に登録する**

現行 `pages/api/line.ts` の処理順を保つ: メソッド判定 → 環境変数確認 → 署名ヘッダー確認 → `Content-Length` が 1MiB 超なら 413 → `await c.req.arrayBuffer()` で読み、`byteLength` が 1MiB 超なら 413 → `validateSignature(Buffer.from(raw), secret, signature)` → JSON 解析 → 全イベントを `Promise.all` で処理 → `{ ok: true }`。`buildReplyText` と `DUMMY_REPLY_TOKEN` は現行のまま移す。`MAX_BODY_BYTES = 1024 * 1024`。`Buffer` は `node:buffer` から import する。

- [ ] **Step 4: テストと型チェックが通ることを確認する**

Run: `yarn test && yarn typecheck`
Expected: Task 1 の 8 件 + 11 件 PASS、tsc エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/server
git commit -m "feat: LINE Webhook を Hono に移植する"
```

---

### Task 3: Vite + React の画面と Cloudflare Workers 構成に切り替え、Next.js を削除する

**Files:**
- Create: `index.html`
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`（`pages/index.tsx` から移動）
- Create: `src/client/index.module.css`（`pages/index.module.css` から移動。無変更）
- Create: `src/client/gtm.ts`
- Create: `src/client/vite-env.d.ts`
- Create: `vite.config.ts`
- Create: `wrangler.jsonc`
- Create: `.node-version`
- Create: `.dev.vars.example`
- Modify: `tsconfig.json`（クライアント用に）
- Modify: `package.json`（依存とスクリプト）
- Modify: `.gitignore`
- Delete: `pages/` 一式、`lib/api.ts`、`.env.example`、`public/google8375f6c0c9e2d40f.html`

**Interfaces:**
- Consumes: Task 1・2 の `src/server/index.ts`（`export default app`。Hono アプリは `fetch` を持つので Worker のエントリとしてそのまま使える）
- Produces:
  - `src/client/gtm.ts`: `export const installGtm = (containerId: string | undefined): void`。ID があれば Google 公式の GTM スニペット相当を `<head>` に挿入し、無ければ何もしない。
  - `src/client/vite-env.d.ts`: `/// <reference types="vite/client" />` と `ImportMetaEnv` に `readonly VITE_GTM_ID?: string` を足す宣言。
  - `yarn dev`（画面 + API）、`yarn build`（`dist/client` と `dist/dazai-method/wrangler.json`）、`yarn preview`、`yarn deploy`、`yarn test`、`yarn typecheck`、`yarn format`

- [ ] **Step 1: 依存を入れ替え、スクリプトを整理する**

```bash
yarn remove next @next/third-parties
yarn add -D vite @vitejs/plugin-react @cloudflare/vite-plugin wrangler @types/react-dom
```

`package.json`: `"type": "module"` を追加。scripts を `dev: vite`、`build: vite build`、`preview: vite preview`、`deploy: yarn build && wrangler deploy`、`test: vitest run`、`typecheck: tsc -p tsconfig.json && tsc -p tsconfig.server.json`、`format: prettier --write index.html src lib` にする。`start` は削除。`engines.node` は `24.x` のまま。

`.node-version` の中身は `24`。

- [ ] **Step 2: 設定ファイルを書く**

`vite.config.ts`: `plugins: [react(), cloudflare({ viteEnvironment: { name: 'worker' } })]`、`environments: { worker: { build: { sourcemap: true } } }`。

`wrangler.jsonc`:
- `"$schema": "./node_modules/wrangler/config-schema.json"`
- `"name": "dazai-method"`
- `"main": "./src/server/index.ts"`
- `"compatibility_date": "2026-10-17"`
- `"compatibility_flags": ["nodejs_compat"]`
- `"upload_source_maps": true`
- `"workers_dev": false`
- `"routes": [{ "pattern": "dazai-method.the-red.jp", "custom_domain": true }]`
- `"observability": { "enabled": true }`
- `"assets": { "run_worker_first": ["/api/*"] }`（`directory` は Vite プラグインが出力時に埋める。`not_found_handling` は既定のままにし、アセットに無いパスは Worker に渡して Hono が 404 を返す）

`tsconfig.json` をクライアント用に書き換える: `compilerOptions` は現行を引き継ぎつつ `types: ["vite/client"]`、`include: ["src/client", "vite.config.ts"]`。`next-env.d.ts` の記述は消す。

`.gitignore`: Next.js 関連（`/.next/`、`/out/`、`next-env.d.ts`）を消し、`dist/`、`.wrangler/`、`.dev.vars` を足す。`.env*` の行は Vite の `.env` 用に残す。

`.dev.vars.example`: 現行 `.env.example` の `OPENAI_API_KEY`、`LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN` をコメントごと移す。`NEXT_PUBLIC_GTM_ID` の項は「`VITE_GTM_ID` は Workers Builds のビルド時変数で設定する。ローカルでは設定しない」という説明に置き換える。

- [ ] **Step 3: 画面を移植する**

`index.html`: `<html lang="ja">`、charset、viewport、`<title>太宰メソッド</title>`、`<link rel="icon" href="/seken.png" />`、`<div id="root"></div>`、`<script type="module" src="/src/client/main.tsx"></script>`。

`src/client/App.tsx`: `pages/index.tsx` の `Home` を `App` として移し、`next/head` の import と `<Head>` ブロックを消す。それ以外のロジックと JSX は変えない。

`src/client/main.tsx`: `installGtm(import.meta.env.VITE_GTM_ID)` を呼んでから `createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)`。

- [ ] **Step 4: Next.js の残骸を消す**

```bash
git rm -r pages lib/api.ts .env.example public/google8375f6c0c9e2d40f.html
```

- [ ] **Step 5: ビルド・型チェック・テストが通ることを確認する**

Run: `yarn build && yarn typecheck && yarn test`
Expected: `dist/client/index.html` と `dist/dazai-method/wrangler.json` が生成され、tsc エラーなし、19 件 PASS。`vite build` が表示する Worker のサイズ（圧縮後）が 3MiB 未満であることを目視する。

- [ ] **Step 6: 開発サーバーで動作確認する**

`.dev.vars` に `OPENAI_API_KEY=dummy` だけ書き、`yarn dev` を起動して別シェルで確認する。

```bash
curl -s http://localhost:5173/ | grep -c 太宰メソッド                      # 1 以上
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/seken.png   # 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/nope        # 404
curl -s -X POST http://localhost:5173/api/decode -H 'Content-Type: application/json' -d '{"text":"それは世間が、ゆるさない"}'
# → {"error":{"message":"An error occurred during your request."}}（ダミーキーで OpenAI が失敗する。ルーティングと 太宰 呼び出しまで通った証拠）
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:5173/api/line   # 500（LINE の環境変数が無い）
```

ブラウザで `http://localhost:5173/` を開き、モード切替とプレースホルダー、送信時のスピナーが移行前と同じに見えることを確認する。

- [ ] **Step 7: Prettier をかけてコミット**

```bash
yarn format
git add -A
git commit -m "feat: Next.js をやめ、Vite + React の画面と Hono の Worker を Cloudflare Workers 構成にする"
```

---

### Task 4: 公開 URL とドキュメントを新構成に合わせる

**Files:**
- Modify: `public/sitemap.xml`、`public/robots.txt`（`https://dazai-method.vercel.app/` を `https://dazai-method.the-red.jp/` に）
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: Task 3 のスクリプト名とファイル構成

- [ ] **Step 1: sitemap と robots の URL を置換する**

- [ ] **Step 2: README を書き直す**

残す: 概要、Web API の表、GTM の手順（環境変数名を `VITE_GTM_ID` にし、設定場所を「Cloudflare ダッシュボードの Worker 設定 > Build > Build variables」に）。
書き換える: 運用環境の URL、Setup（`.dev.vars.example` を `.dev.vars` にコピー、`yarn dev`、`http://localhost:5173`）、LINE Webhook の節（`src/server/line.ts`、Webhook URL、シークレットは Worker の Settings > Variables & Secrets に設定）、Search Console の節（HTML タグ方式。`index.html` の `<head>` に `<meta name="google-site-verification" content="...">` を書く。確認ファイルは廃止）。
追加: デプロイの節（`main` への push で Workers Builds が `yarn build` → `wrangler deploy` を実行する。手動なら `yarn deploy`）。

- [ ] **Step 3: CLAUDE.md を書き直す**

概要（Hono + React(Vite)、Cloudflare Workers、URL）、コマンド（`dev` / `build` / `preview` / `deploy` / `test` / `typecheck` / `format`。型チェックはビルドに含まれないので `yarn typecheck` を別に実行すると明記）、アーキテクチャ（`lib/dazai.ts` の節はメソッド名を `decode` / `encode` / `guide` / `failed` に直す。`src/server` と `src/client` の責務。`public/` から確認ファイルの記述を消す）、運用上の前提（Worker のシークレット 3 つとビルド時変数 `VITE_GTM_ID`、カスタムドメイン、LINE Webhook URL、Search Console は HTML タグ方式、Vercel は廃止済み）、コードスタイル（そのまま）。`.env` に関する記述は `.dev.vars` に置き換える。

- [ ] **Step 4: 旧 URL が設計・計画文書以外に残っていないことを確認する**

Run: `git grep -n 'vercel.app' -- ':!docs/'`
Expected: 出力なし

- [ ] **Step 5: コミット**

```bash
git add public README.md CLAUDE.md
git commit -m "docs: 公開 URL と README / CLAUDE.md を Cloudflare Workers 構成に合わせる"
```

---

## 実装後の切り替え作業（利用者のダッシュボード操作。設計書「切り替え手順」参照）

コードの作業はここまで。以下は設計書に書いた手順を実装者向けに要約したもので、タスクではない。

1. Cloudflare ダッシュボードで Workers Builds から `the-red/dazai-method` を接続。本番ブランチ `main`、ビルドコマンド `yarn build`、デプロイコマンド `yarn wrangler deploy`。
2. Worker の Settings > Variables & Secrets にシークレット 3 つ、Build variables に `VITE_GTM_ID`。
3. `v2` のプレビューで画面と `/api/decode` を確認し、`main` にマージして本番デプロイ。
4. LINE Developers の Webhook URL を `https://dazai-method.the-red.jp/api/line` に変更し「検証」。失敗したらゾーンの WAF / Bot Fight Mode のスキップルールを疑う。
5. Search Console で新プロパティを作り、表示された `content` 値を `index.html` の meta タグに書いてデプロイし「確認」。サイトマップ再送信。
6. Vercel プロジェクトを削除。
