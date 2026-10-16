# OpenAI 太宰メソッド

## 運用環境
### Webアプリ（Next.js）
https://dazai-method.vercel.app/

### LINEチャットボット
https://lin.ee/s8kHQfL2

## Setup

1. If you don’t have Node.js installed, [install it from here](https://nodejs.org/en/)

2. Clone this repository

3. Navigate into the project directory

   ```bash
   $ cd dazai-method
   ```

4. Install the requirements

   ```bash
   $ yarn install
   ```

5. Make a copy of the example environment variables file

   On Linux systems: 
   ```bash
   $ cp .env.example .env
   ```
   On Windows:
   ```powershell
   $ copy .env.example .env
   ```
6. Add your [API key](https://platform.openai.com/account/api-keys) to the newly created `.env` file

   LINE チャットボットも動かす場合は、LINE Developers コンソールの値も設定する
   - `LINE_CHANNEL_SECRET`: チャネル基本設定 > チャネルシークレット
   - `LINE_CHANNEL_ACCESS_TOKEN`: Messaging API 設定 > チャネルアクセストークン（長期）

7. Run the app

   ```bash
   $ npm run dev
   ```

You should now be able to access the app at [http://localhost:3000](http://localhost:3000)!

## LINE チャットボット（Webhook）

Webhook は Next.js の API Route `pages/api/line.ts` で受けている。
Vercel にデプロイしたうえで、LINE Developers コンソールの Messaging API 設定で Webhook URL を次のように設定する。

```
https://dazai-method.vercel.app/api/line
```

Vercel の環境変数に `OPENAI_API_KEY`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` を設定すること。
`X-Line-Signature` による署名検証を行うため、LINE プラットフォーム以外からのリクエストは 401 で拒否される。
