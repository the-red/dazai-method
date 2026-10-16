# OpenAI 太宰メソッド

## 運用環境
### Webアプリ（React + Hono / Cloudflare Workers）
https://dazai-method.the-red.app/

### LINEチャットボット
https://lin.ee/s8kHQfL2

## Setup

1. If you don't have Node.js installed, [install it from here](https://nodejs.org/en/)（24 系。`.tool-versions` / `.node-version` 参照）

2. Clone this repository

3. Navigate into the project directory

   ```bash
   $ cd dazai-method
   ```

4. Install the requirements

   ```bash
   $ yarn install
   ```

5. Make a copy of the example secrets file

   ```bash
   $ cp .dev.vars.example .dev.vars
   ```

6. Add your [API key](https://platform.openai.com/account/api-keys) to the newly created `.dev.vars` file

   LINE チャットボットも動かす場合は、LINE Developers コンソールの値も設定する
   - `LINE_CHANNEL_SECRET`: チャネル基本設定 > チャネルシークレット
   - `LINE_CHANNEL_ACCESS_TOKEN`: Messaging API 設定 > チャネルアクセストークン（長期）

7. Run the app

   ```bash
   $ yarn dev
   ```

You should now be able to access the app at [http://localhost:5173](http://localhost:5173)!

その他のコマンド:

```bash
yarn test        # vitest（API と LINE Webhook の契約テスト）
yarn typecheck   # 型チェック（ビルドには含まれない）
yarn build       # 本番ビルド（dist/client と dist/worker）
yarn preview     # ビルド成果物をローカルで確認
```

## Web API

| エンドポイント | 太宰メソッド | 入力 | 出力 |
| --- | --- | --- | --- |
| `POST /api/decode` | `decode()` | 太宰メソッド（世間を主語にした発言） | 主語を本人に戻した切り返し |
| `POST /api/encode` | `encode()` | 一人称の本音 | 大きな主語に託した太宰メソッドの言い方 |

リクエストは `{ "text": "..." }`、レスポンスは `{ "result": "..." }` または `{ "error": { "message": "..." } }`。
ボディは 1MiB まで（超えると 413）。

## デプロイ（Cloudflare Workers）

Cloudflare の Workers Builds で GitHub リポジトリと連携しており、`main` ブランチへ push すると
`yarn build` → `wrangler deploy` が自動で走る。手元から上げる場合は `yarn deploy`。

Worker の設定（`wrangler.jsonc`）でカスタムドメイン `dazai-method.the-red.app` を指定しているので、
DNS レコードと証明書は初回デプロイ時に Cloudflare が自動で作る。`workers.dev` の既定 URL は無効化している。

Cloudflare ダッシュボードの Worker 設定で次を登録する。

- Settings > Variables & Secrets: `OPENAI_API_KEY`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`
- Settings > Build > Build variables: `VITE_GTM_ID`（下記）

## LINE チャットボット（Webhook）

Webhook は Hono のハンドラ `src/server/line.ts` で受けている。
LINE Developers コンソールの Messaging API 設定で Webhook URL を次のように設定する。

```
https://dazai-method.the-red.app/api/line
```

`X-Line-Signature` による署名検証を行うため、LINE プラットフォーム以外からのリクエストは 401 で拒否される。
コンソールの「検証」が 4xx で失敗する場合は、`the-red.app` ゾーンの WAF / Bot Fight Mode が LINE からの POST を
弾いていないか確認する（必要なら `/api/*` のスキップルールを追加する）。

## アクセス解析（Google Analytics / Search Console）

### Google タグマネージャー（GTM）経由の Google Analytics 4

`src/client/gtm.ts` が GTM のスニペットを挿入する。
コンテナ ID はビルド時の環境変数 `VITE_GTM_ID` から取り、未設定なら何も埋め込まない。
GA4 の計測タグはコードではなく GTM 側で設定するので、GA の測定 ID をリポジトリや Cloudflare に持つ必要はない。

1. GTM でコンテナを作り、右上に表示されるコンテナ ID（`GTM-XXXXXXX`）を控える
2. GTM で「Google タグ」を追加し、タグ ID に GA4 の測定 ID（`G-XXXXXXXXXX`）を入れ、トリガーを「All Pages（Initialization）」にして公開する
3. Cloudflare ダッシュボードの Worker 設定 > Build > Build variables に `VITE_GTM_ID` を追加する
4. 再デプロイすると計測が始まる。GA4 の「リアルタイム」レポートで自分のアクセスが見えれば OK

### Google Search Console

所有権の確認は「HTML タグ」方式。Search Console が表示する `<meta name="google-site-verification" content="...">` を
`index.html` の `<head>` に書いてデプロイする。
（Workers の静的アセット配信は `.html` 付き URL をリダイレクトするため、HTML ファイル方式は使えない）

1. Search Console で URL プレフィックス `https://dazai-method.the-red.app/` のプロパティを追加する
2. 表示された meta タグを `index.html` に追加してデプロイし、Search Console の「確認」を押す
3. 左メニュー「サイトマップ」から `sitemap.xml` を送信する（`public/sitemap.xml`。`public/robots.txt` からも参照している）

検索クエリは「検索パフォーマンス」レポートに数日遅れで反映される。
