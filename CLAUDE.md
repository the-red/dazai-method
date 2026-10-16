# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

「太宰メソッド」（自分の意見を「世間」「みんな」などの大きな主語に託す話法）を検出し、
『人間失格』の主人公として「世間じゃない。あなたが〜でしょう？」と切り返す OpenAI チャットボット。
同じプロンプトで 2 つの配信形態がある。

- **Web アプリ**: React（Vite）の単一ページ + Hono の API。Cloudflare Workers にデプロイ（https://dazai-method.the-red.jp/）。
  「世間じゃない」（太宰メソッドに切り返す）と「世間に託す」（本音を太宰メソッドに変換する）の 2 モード
- **LINE チャットボット**: 同じ Worker の `/api/line` が LINE Messaging API の Webhook として動作

## コマンド

パッケージマネージャは yarn 1。Node は `.tool-versions`（mise 管理）と `.node-version`（Workers Builds 用）の 24 系に従う。

```bash
yarn install        # 依存インストール
yarn dev            # 開発サーバー起動（http://localhost:5173。画面と API が同時に立ち上がる）
yarn build          # 本番ビルド（dist/client に静的アセット、dist/worker に Worker と wrangler.json）
yarn preview        # ビルド成果物をローカルで確認
yarn deploy         # ビルドして wrangler deploy（通常は push で自動デプロイされるので手動時のみ）
yarn test           # vitest（src/server のテスト）
yarn typecheck      # tsc（クライアントとサーバーを別の tsconfig で検査。ビルドには含まれない）
yarn format         # Prettier で index.html, src/, lib/ を整形
```

lint の仕組みは存在しない。型チェックは `yarn build` に含まれないので、変更後は `yarn typecheck` と `yarn test` を別に実行する。

ローカル実行には `.dev.vars` に `OPENAI_API_KEY` が必要（`.dev.vars.example` をコピーして設定）。
LINE Webhook を動かす場合は `LINE_CHANNEL_SECRET` と `LINE_CHANNEL_ACCESS_TOKEN` も必要。

## アーキテクチャ

### 共通モジュール（`lib/dazai.ts`）

- default export の `太宰` クラスに、システムプロンプト、使用モデル（`MODEL`）、OpenAI 呼び出し、人格に属する定型文を一元化。
  呼び出し側は `import 太宰 from` で受けて `new 太宰({ apiKey })` とし、`dazai.decode(seken)` のように呼ぶ。
  Web と LINE の両方がこのクラスを使うので、プロンプトやモデルや文言の変更はこのファイルだけで済む。
- **`太宰` クラスが提供するメソッドを総称して「太宰メソッド」と呼ぶ。** 「太宰メソッド」の名にちなんだ意図的な設計で、
  クラス名は日本語のまま、namespace や単なるオブジェクトや関数にはしない（英語化・関数化・namespace 化しない）。
  現在のメソッド: `decode(発言)`（LLM 呼び出し。太宰メソッドに対する主人公の切り返しを返す。太宰メソッドでなければ定型文）、
  `encode(本音)`（LLM 呼び出し。本音を太宰メソッドの言い方に変換する）、
  `guide()`（テキスト以外を受けたときに文章で送るよう案内する定型文）、`failed()`（LLM 失敗時のフォールバック文）。
  メソッド名は英語で、decode / encode / guide / failed のように語尾を -de か -ed にそろえる。
  使われていないメソッドは置かない。
- OpenAI の API キーはコンストラクタの必須引数。クラスの中で環境変数は読まず、ハンドラ側が `c.env` を確認してから渡す。
  人格（ロールプレイする人物）とモデルは省略可能オプションで差し替えられる。
  生成後に変えられる setter は意図的に設けない（共有インスタンスの振る舞いが途中で変わるのを防ぐ）。
  差し替えられるのは人格の一文だけで、前提知識・例文・行動指針（太宰メソッドでないときの定型文を含む）はクラスが必ずプロンプトに付ける。

### サーバー側（`src/server/`、Hono）

- `index.ts` — Worker のエントリ。`Hono` アプリにルートを登録し default export する。
  静的アセットに一致しなかったリクエストだけがここに届き、未知のパスは Hono の既定で 404。
  `/api/decode` と `/api/encode` には 1MiB の `bodyLimit`（413 JSON）、`/api/line` にも 1MiB の `bodyLimit`（413 空ボディ）を前置している。
- `api.ts` — `createHandler(invoke)`。API キー確認・入力検証（`{ text: string }`）・エラー処理を共通化し、
  ルート側はどの太宰メソッドを呼ぶかだけを書く。レスポンスは `{ result }` または `{ error: { message } }`。
  太宰メソッドを「本音を世間語にエンコードしたもの」と見立てた命名で、decode が切り返し（世間→あなた）、encode が世間に託す（あなた→世間）。
- `line.ts` — `handleLineWebhook`。`@line/bot-sdk` の `validateSignature` で `X-Line-Signature` を検証し、
  不正なリクエストは 401 で拒否する。署名検証に生ボディが必要なので `c.req.arrayBuffer()` で読む。
  `validateSignature` が `node:crypto` を使うため `wrangler.jsonc` で `nodejs_compat` を有効にしている。
  1 回の Webhook に含まれる全イベントを処理し、テキスト以外のメッセージには定型文、OpenAI 失敗時はフォールバック文を返す。
  POST 以外は 405 を返す（`app.all` で受けてハンドラ内で判定）。
- `bindings.ts` — Worker のシークレットの型 `Bindings` と Hono 用の `AppEnv`。シークレットは `process.env` ではなく `c.env` から読む。
- テストは `*.test.ts`（vitest、Node 上で `app.request()` を直接呼ぶ）。`太宰` と LINE の返信クライアントはモックし、署名検証は本物を使う。

### 画面側（`src/client/`、React + Vite）

- `App.tsx` — 単一ページの UI。モード切り替え（decode / encode）に応じて `/api/decode` または `/api/encode` に
  `{ text: string }` を POST し、`{ result }` または `{ error: { message } }` を受け取って表示する。
- `main.tsx` — React のマウント。先に `installGtm(import.meta.env.VITE_GTM_ID)` を呼ぶ。
- `gtm.ts` — Google タグマネージャーのスニペットを挿入する。コンテナ ID が無ければ何もしない。GA4 の計測タグは GTM 側で設定している。
- `index.module.css` — スタイルは CSS Modules のみ。
- `index.html`（リポジトリ直下）が Vite のエントリ。`<title>`、favicon、Search Console の確認用 meta タグはここに書く。

### ビルドとデプロイ

- `vite.config.ts` で `@vitejs/plugin-react` と `@cloudflare/vite-plugin` を使い、画面と Worker を 1 つの Vite プロジェクトで扱う。
  `yarn build` で `dist/client`（静的アセット）と `dist/worker`（Worker 本体と出力用 `wrangler.json`）ができる。
- `wrangler.jsonc` が Worker の設定。`workers_dev: false` で既定 URL を無効化し、`routes` のカスタムドメイン
  `dazai-method.the-red.jp` だけで公開する。`assets.run_worker_first: ["/api/*"]` で API は常に Worker に渡す。
- `compatibility_date` はインストール済み wrangler（workerd）が対応する日付までしか指定できない。wrangler を上げたら進める。
- デプロイは Cloudflare の Workers Builds（GitHub 連携）。`main` への push で `yarn build` → `wrangler deploy` が走る。

### 静的ファイル（`public/`）

- `robots.txt` / `sitemap.xml` — Search Console 用。`/api/` 配下はクロール対象外。
- `dazai.webp` / `seken.png` — 画面の画像と favicon。

### 運用上の前提

- Cloudflare の Worker 設定 > Variables & Secrets に `OPENAI_API_KEY`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` を、
  Build > Build variables に `VITE_GTM_ID`（GTM コンテナ ID。画面のバンドルに埋め込まれる）を設定している。
  GA4 の測定 ID は GTM 内にあり、コードには登場しない。
- `the-red.jp` のゾーンは Worker と同じ Cloudflare アカウントで DNS 管理している。カスタムドメインの DNS レコードと証明書は
  `wrangler deploy` が自動で作る。
- Google Search Console は `https://dazai-method.the-red.jp/` を URL プレフィックスで登録し、HTML タグ方式（`index.html` の meta タグ）で所有権確認する。
  Workers の静的アセット配信は `.html` 付き URL をリダイレクトするので、HTML ファイル方式は使えない。
- LINE Developers コンソールの Webhook URL は `https://dazai-method.the-red.jp/api/line`。
  LINE の「検証」が 4xx で失敗する場合は、ゾーンの WAF / Bot Fight Mode が LINE からの POST を弾いていないか疑う。
- 2026-10 に Vercel（Next.js）から Cloudflare Workers（Hono + Vite）へ移行した。Vercel のプロジェクトは削除済み。
  移行の経緯と設計は `docs/superpowers/specs/2026-10-17-hono-cloudflare-migration-design.md` にある。
- 2026-10 まで LINE Webhook は Google Apps Script で動いていたが、署名検証ができないため Vercel に移行し、GAS 実装は削除済み。

## コードスタイル

Prettier 設定（`.prettierrc.yaml`）: セミコロンなし、シングルクォート、printWidth 120。
