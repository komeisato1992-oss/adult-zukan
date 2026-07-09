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
