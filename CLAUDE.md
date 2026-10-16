# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

「太宰メソッド」（自分の意見を「世間」「みんな」などの大きな主語に託す話法）を検出し、
『人間失格』の主人公として「世間じゃない。あなたが〜でしょう？」と切り返す OpenAI チャットボット。
同じプロンプトで 2 つの配信形態がある。

- **Web アプリ**: Next.js（Pages Router）。Vercel にデプロイ（https://dazai-method.vercel.app/）
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

- システムプロンプト（`generateMessages`）、使用モデル（`MODEL`）、OpenAI 呼び出し（`dazai.太宰()`）をここに一元化。
  コアの処理は default export したオブジェクトのメソッド `太宰()` として定義し、呼び出し側は `import dazai from` で受けて `dazai.太宰(seken)` と呼ぶ。
  「太宰メソッド」の名にちなんだ意図的な日本語識別子であり、関数ではなくメソッドとして定義していることも意図的（英語化・関数化しない）。
  Web と LINE の両方がこのモジュールを使うので、プロンプトやモデルの変更はこのファイルだけで済む。

### Next.js 側（`pages/`）

- `pages/index.tsx` — 単一ページの UI。入力フォームから `/api/generate` に `{ dazai: string }` を POST し、
  `{ result }` または `{ error: { message } }` を受け取って表示する。
- `pages/api/generate.ts` — Web 用 API Route。入力を検証して `dazai.太宰()` を呼ぶ。
- `pages/api/line.ts` — LINE Webhook。`@line/bot-sdk` の `validateSignature` で `X-Line-Signature` を検証し、
  不正なリクエストは 401 で拒否する。署名検証に生ボディが必要なため `bodyParser: false`。
  1 回の Webhook に含まれる全イベントを処理し、テキスト以外のメッセージには定型文、OpenAI 失敗時はフォールバック文を返す。
- `pages/index.module.css` — スタイルは CSS Modules のみ。

### 運用上の前提

- Vercel の環境変数に `OPENAI_API_KEY`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` を設定している。
- LINE Developers コンソールの Webhook URL は `https://dazai-method.vercel.app/api/line`。
- 2026-10 まで LINE Webhook は Google Apps Script で動いていたが、署名検証ができないため Vercel に移行し、GAS 実装は削除済み。

## コードスタイル

Prettier 設定（`.prettierrc.yaml`）: セミコロンなし、シングルクォート、printWidth 120。
