# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

「太宰メソッド」（自分の意見を「世間」「みんな」などの大きな主語に託す話法）を検出し、
『人間失格』の主人公として「世間じゃない。あなたが〜でしょう？」と切り返す OpenAI チャットボット。
同じプロンプトで 2 つの配信形態がある。

- **Web アプリ**: Next.js（Pages Router）。Vercel にデプロイ（https://dazai-method.vercel.app/）
- **LINE チャットボット**: Google Apps Script（`gas/code.js`）。LINE Messaging API の Webhook として動作

## コマンド

パッケージマネージャは yarn。Node は `.tool-versions`（mise 管理、メジャーバージョン 24 のみ指定）に従う。

```bash
yarn install        # 依存インストール
yarn dev            # 開発サーバー起動（http://localhost:3000）
yarn build          # 本番ビルド
yarn start          # 本番サーバー起動
yarn format         # Prettier で pages/ 配下を整形
```

テスト・lint の仕組みは存在しない。型チェックは `yarn build` に含まれる（`tsconfig.json` は strict）。

ローカル実行には `.env` に `OPENAI_API_KEY` が必要（`.env.example` をコピーして設定）。

## アーキテクチャ

### Next.js 側（`pages/`）

- `pages/index.tsx` — 単一ページの UI。入力フォームから `/api/generate` に `{ dazai: string }` を POST し、
  `{ result }` または `{ error: { message } }` を受け取って表示する。
- `pages/api/generate.ts` — API Route。OpenAI SDK v4 の `chat.completions.create`（モデル `gpt-4o`）を呼ぶ。
  システムプロンプトは同ファイル内の `generateMessages` に定義。
- `pages/index.module.css` — スタイルは CSS Modules のみ。

### GAS 側（`gas/code.js`）

- Next.js のビルド対象外。Apps Script エディタに手動でコピーしてデプロイする独立したスクリプト。
- `doPost` が LINE の Webhook を受け、`UrlFetchApp` で OpenAI REST API を直接叩く（SDK は使えない）。
- 秘匿情報は `PropertiesService` のスクリプトプロパティ（`LINE_ACCESS_TOKEN`, `OPENAI_APIKEY`）から取得。
- モデルは `gpt-3.5-turbo` のまま（Web 側は `gpt-4o`）。意図的かどうかは不明なので、変更時は確認する。

### プロンプトの二重管理

システムプロンプト（`generateMessages`）は `pages/api/generate.ts` と `gas/code.js` の **両方に同一内容でコピー** されている。
プロンプトを変更するときは両ファイルを同時に更新し、内容を揃えること。

## コードスタイル

Prettier 設定（`.prettierrc.yaml`）: セミコロンなし、シングルクォート、printWidth 120。
`gas/code.js` は `yarn format` の対象外なので、編集時は手動で同じスタイルに合わせる。
