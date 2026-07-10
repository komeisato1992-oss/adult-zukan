This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 開発環境

このリポジトリは **npm** を使います（`package-lock.json` あり）。

| ファイル | パッケージマネージャ |
| --- | --- |
| `package-lock.json` | npm |
| `pnpm-lock.yaml` | pnpm（未使用） |
| `yarn.lock` | yarn（未使用） |

### 初回セットアップ

Node.js **20 以上**が必要です（`.nvmrc` 参照）。

**nvm を使う場合（推奨）**

```bash
# nvm 未導入なら一度だけ実行
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# ターミナルを開き直してから
cd adult-zukan
nvm install
npm install
```

**Node.js を直接インストールした場合**

[https://nodejs.org/](https://nodejs.org/) から LTS を入れたあと:

```bash
npm install
```

自動セットアップスクリプト:

```bash
bash scripts/setup-dev.sh
```

### 開発サーバー起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いて確認してください。

`npm run dev` は `scripts/dev.mjs` 経由でポート 3000 の既存プロセスを整理してから `next dev` を起動します。

**npm が `command not found` の場合**

Node.js が PATH に無い状態です。次のいずれかで起動できます。

```bash
# セットアップ（nvm + npm install）
bash scripts/setup-dev.sh

# または npm なしで開発サーバーだけ起動（node_modules 済みの場合）
bash bin/dev
```

Cursor 同梱の Node を直接使う場合:

```bash
/Applications/Cursor.app/Contents/Resources/app/resources/helpers/node scripts/dev.mjs
```

### その他コマンド

```bash
npm run build    # 本番ビルド
npm run start    # 本番サーバー
npm run lint     # ESLint
```

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Google Analytics (GA4)

This project uses the official Next.js integration via [`@next/third-parties/google`](https://nextjs.org/docs/app/building-your-application/optimizing/third-party-libraries#google-analytics). `GoogleAnalytics` is loaded in `app/layout.tsx` and sends page views on all routes.

Analytics runs **only in production** (`NODE_ENV=production`). Local `npm run dev` does not load GA even if the env var is set.

### Environment variables

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 measurement ID (e.g. `G-XXXXXXXXXX`) |

### Local setup

Add to `.env.local`:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-KR3DQVXBHZ
```

### Vercel setup

1. Open the project on Vercel → **Settings** → **Environment Variables**
2. Add `NEXT_PUBLIC_GA_MEASUREMENT_ID` with value `G-KR3DQVXBHZ`
3. Scope it to **Production** only (Preview/Development are optional and usually left unset)
4. Redeploy after saving

Google Search Console verification uses a separate `<meta name="google-site-verification">` tag in the same layout and does not conflict with GA4.

## Admin CMS (作品追加)

The admin import page (`/admin/import`) can add works directly to `data/dmm/catalog-snapshot.json` via the GitHub Contents API. After a successful add, Vercel redeploys from `main` and production updates within a few minutes.

### Required environment variables

Set these in **`.env.local`** for local admin use and in **Vercel → Settings → Environment Variables** for production.

| Variable | Description |
| --- | --- |
| `ADMIN_PASSWORD` | Admin login password (existing) |
| `GITHUB_TOKEN` | GitHub personal access token with `contents:write` on the repo (**server only**) |
| `GITHUB_OWNER` | GitHub username or organization |
| `GITHUB_REPO` | Repository name (default: `adult-zukan`) |
| `GITHUB_BRANCH` | Target branch (default: `main`) |

### Local setup example

```bash
ADMIN_PASSWORD=your-admin-password
GITHUB_TOKEN=ghp_xxxxxxxx
GITHUB_OWNER=your-github-owner
GITHUB_REPO=adult-zukan
GITHUB_BRANCH=main
```

**Security notes**

- Never expose `GITHUB_TOKEN` to the client or commit it to git.
- The token is only used in server-side API routes such as `POST /api/admin/import/add-work`.
- Admin APIs require an authenticated admin session cookie.

## Google Search Console API（SEO管理）

管理画面 `/admin/seo` から Search Console のデータを取得・表示します。環境変数は Next.js 標準どおり **`.env.local`（ローカル）** と **Vercel 環境変数（本番）** から `process.env` 経由で読み込まれます。

### 前提

1. Google Cloud で **Search Console API** を有効化
2. サービスアカウントを作成し、JSON キーをダウンロード
3. Search Console → 設定 → ユーザーと権限 で、サービスアカウントのメールアドレスを **フル** 権限で追加

### 環境変数

| Variable | Description |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | サービスアカウント JSON を **1行** で設定（`client_email` / `private_key` 必須） |
| `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` | 上記 JSON を Base64 エンコードした値（Vercel 向け） |
| `GOOGLE_SERVICE_ACCOUNT_JSON_PATH` | ローカル開発のみ: JSON ファイルへのパス |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | 分割設定: サービスアカウントのメール |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | 分割設定: private key（`\\n` エスケープ） |
| `GSC_SITE_URL` | Search Console プロパティ URL（例: `https://adult-zukan.jp/` または `sc-domain:adult-zukan.jp`） |
| `CRON_SECRET` | 日次自動更新用（Vercel Cron。任意） |

### キャッシュ

- **常にメモリキャッシュのみ**（Production / Vercel 含む）
- JSON ファイル（`data/admin/seo-cache.json`）への保存は行いません

### ローカル設定例（`.env.local`）

```bash
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"seo@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
GSC_SITE_URL=https://adult-zukan.jp/
CRON_SECRET=your-random-secret
```

**JSON の設定ポイント**

- `.env.local` では改行を含めず、**1行の JSON** として保存してください
- `private_key` 内の改行は `\\n` にエスケープしてください
- `GSC_SITE_URL` は Search Console に表示されているプロパティ URL と **完全一致** させてください
  - URL-prefix プロパティ: 末尾スラッシュ付き（例: `https://adult-zukan.jp/`）
  - ドメインプロパティ: `sc-domain:adult-zukan.jp`

### Vercel 設定

1. Vercel → **Settings** → **Environment Variables**
2. `GOOGLE_SERVICE_ACCOUNT_JSON` と `GSC_SITE_URL` を **Production**（必要なら Preview）に追加
3. 日次自動更新を使う場合は `CRON_SECRET` も追加
4. 再デプロイ後、管理画面 `/admin/seo` の **更新** ボタンでデータ取得

### エラー表示

環境変数未設定・認証失敗時は管理画面に原因を表示します。

| 症状 | 確認項目 |
| --- | --- |
| JSONが不正 | `GOOGLE_SERVICE_ACCOUNT_JSON` の JSON 形式、`private_key` の `\\n` エスケープ |
| Search Console権限不足 | サービスアカウントをプロパティにフル権限で追加済みか |
| GSC_SITE_URLが違う | Search Console のプロパティ URL と完全一致しているか |
| APIが有効化されていない | Google Cloud Console で Search Console API を有効化したか |
