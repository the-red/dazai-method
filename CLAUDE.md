# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

「太宰メソッド」（自分の意見を「世間」「みんな」などの大きな主語に託す話法）を検出し、
『人間失格』の主人公として「世間じゃない。あなたが〜でしょう？」と切り返す OpenAI チャットボット。
同じプロンプトで 2 つの配信形態がある。

- **Web アプリ**: Next.js（Pages Router）。Vercel にデプロイ（https://dazai-method.vercel.app/）。
  「世間じゃない」（太宰メソッドに切り返す）と「世間に託す」（本音を太宰メソッドに変換する）の 2 モード
- **LINE チャットボット**: 同じ Next.js の API Route（`pages/api/line.ts`）が LINE Messaging API の Webhook として動作

## コマンド

パッケージマネージャは yarn。Node は `.tool-versions`（mise 管理、メジャーバージョン 24 のみ指定）に従う。

```bash
yarn install        # 依存インストール
yarn dev            # 開発サーバー起動（http://localhost:3000）
yarn build          # 本番ビルド
yarn start          # 本番サーバー起動
yarn format         # Prettier で pages/ と lib/ 配下を整形
```

テスト・lint の仕組みは存在しない。型チェックは `yarn build` に含まれる（`tsconfig.json` は strict）。

ローカル実行には `.env` に `OPENAI_API_KEY` が必要（`.env.example` をコピーして設定）。
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
- OpenAI の API キーはコンストラクタの必須引数。クラスの中で `process.env` は読まず、API Route 側が環境変数を確認してから渡す。
  人格（ロールプレイする人物）とモデルは省略可能オプションで差し替えられる。
  生成後に変えられる setter は意図的に設けない（共有インスタンスの振る舞いが途中で変わるのを防ぐ）。
  差し替えられるのは人格の一文だけで、前提知識・例文・行動指針（太宰メソッドでないときの定型文を含む）はクラスが必ずプロンプトに付ける。

### Next.js 側（`pages/`）

- `pages/index.tsx` — 単一ページの UI。モード切り替え（decode / encode）に応じて `/api/decode` または `/api/encode` に
  `{ text: string }` を POST し、`{ result }` または `{ error: { message } }` を受け取って表示する。
- `pages/api/decode.ts` / `pages/api/encode.ts` — Web 用 API Route。それぞれ `太宰.decode()` / `太宰.encode()` を 1 対 1 で公開する。
  太宰メソッドを「本音を世間語にエンコードしたもの」と見立てた命名で、decode が切り返し（世間→あなた）、encode が世間に託す（あなた→世間）。
  API キー確認・入力検証・エラー処理は `lib/api.ts` の `createHandler` に共通化してあり、ルート側はどのメソッドを呼ぶかだけを書く。
- `pages/api/line.ts` — LINE Webhook。`@line/bot-sdk` の `validateSignature` で `X-Line-Signature` を検証し、
  不正なリクエストは 401 で拒否する。署名検証に生ボディが必要なため `bodyParser: false`。
  1 回の Webhook に含まれる全イベントを処理し、テキスト以外のメッセージには定型文、OpenAI 失敗時はフォールバック文を返す。
- `pages/_app.tsx` — 全ページ共通のラッパー。環境変数 `NEXT_PUBLIC_GTM_ID` があるときだけ
  `@next/third-parties/google` の `GoogleTagManager` を埋め込む。GA4 の計測タグは GTM 側で設定している。
- `pages/index.module.css` — スタイルは CSS Modules のみ。

### 静的ファイル（`public/`）

- `robots.txt` / `sitemap.xml` — Search Console 用。`/api/` 配下はクロール対象外。
- `google8375f6c0c9e2d40f.html` — Search Console の所有権確認用（HTML ファイル方式）。削除すると確認が外れる。

### 運用上の前提

- Vercel の環境変数に `OPENAI_API_KEY`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`,
  `NEXT_PUBLIC_GTM_ID`（GTM コンテナ ID）を設定している。GA4 の測定 ID は GTM 内にあり、コードには登場しない。
- Google Search Console は `https://dazai-method.vercel.app/` を URL プレフィックスで登録し、HTML ファイル方式で所有権確認している。
- LINE Developers コンソールの Webhook URL は `https://dazai-method.vercel.app/api/line`。
- 2026-10 まで LINE Webhook は Google Apps Script で動いていたが、署名検証ができないため Vercel に移行し、GAS 実装は削除済み。

## コードスタイル

Prettier 設定（`.prettierrc.yaml`）: セミコロンなし、シングルクォート、printWidth 120。
