# adult-zukan 専用 Supabase 初期設定

競馬用プロジェクト（例: `miopcviznteojsjfiufb`）は使わない。  
アダルト図鑑専用の新規プロジェクトを作成してから以下を実施する。

## 1. プロジェクト作成

1. [Supabase Dashboard](https://supabase.com/dashboard) → **New project**
2. 名前例: `adult-zukan`
3. リージョン: 任意（本番と同じでよい）
4. 作成後、**Project Settings → API** で以下を控える
   - Project URL → `SUPABASE_URL`
   - `anon` `public` → `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` → `SUPABASE_SERVICE_ROLE_KEY`（サーバーのみ。Git・ブラウザ禁止）

## 2. Migration 適用順

どちらか一方でよい。

### A. 一括（推奨）

SQL Editor で [`bootstrap.sql`](./bootstrap.sql) を全文実行。

### B. 分割

SQL Editor で次の順に実行:

1. [`migrations/20260715_001_work_live_status.sql`](./migrations/20260715_001_work_live_status.sql)
2. [`migrations/20260715_002_works.sql`](./migrations/20260715_002_works.sql)

適用後 Table Editor で `work_live_status` と `works` が見えること。  
見えない場合は Project Settings → API → **Reload schema**。

## 3. Environment Variables 設定箇所

| 変数 | 用途 | 設定場所 |
|---|---|---|
| `SUPABASE_URL` | プロジェクト URL | `.env.local` / Vercel Production・Preview |
| `SUPABASE_ANON_KEY` | anon（公開可・現状サーバー主用途は service_role） | `.env.local` / Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ブラウザ用 anon（将来クライアント利用時） | `.env.local` / Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー upsert/select（RLS バイパス） | `.env.local` / Vercel（**Secret・非公開**） |
| `WORK_LIVE_STATUS_BACKEND=auto` | 変動情報の保存先 | `.env.local` / Vercel |
| `WORK_LIVE_STATUS_ENABLED=true` | 変動情報 DB 有効 | `.env.local` / Vercel |
| `WORKS_MASTER_BACKEND=auto` | 作品マスター保存先 | `.env.local` / Vercel |
| `WORKS_MASTER_ENABLED=true` | 作品マスター有効 | `.env.local` / Vercel |

### `.env.local` 例

```bash
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...          # または新しい sb_publishable_...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # または新しい sb_secret_... / service_role JWT

WORK_LIVE_STATUS_ENABLED=true
WORK_LIVE_STATUS_BACKEND=auto
WORK_LIVE_STATUS_REVALIDATE_SEC=600

WORKS_MASTER_ENABLED=true
WORKS_MASTER_BACKEND=auto
WORKS_MASTER_REVALIDATE_SEC=600
```

### Vercel

Project → Settings → Environment Variables に上記を追加（Production / Preview）。  
`SUPABASE_SERVICE_ROLE_KEY` は Sensitive。`NEXT_PUBLIC_*` 以外に service_role を載せない。

### コード参照箇所

| 変数 | 読み込み |
|---|---|
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | `lib/dmm/work-live-status/types.ts` → `getSupabaseUrl()` |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` | 同上 → `getSupabaseServiceRoleKey()` |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同上 → `getSupabaseAnonKey()` |
| クライアント生成 | `lib/supabase/server.ts`（service_role のみ） |

## 4. 接続確認

```bash
node scripts/verify-supabase-adult-zukan.mjs
```

`works` と `work_live_status` が API に見えること。競馬用テーブルだけ見える場合は URL が誤り。

## 5. 設定完了後の検証

```bash
# 作品マスター 100件追加（Git/JSON/deploy なし）
node scripts/test-works-master-add-100.mjs --count 100

# 価格同期（work_live_status）初期投入 100件
node scripts/migrate-work-live-status.mjs --limit=100

npx next build
npm run dev
```

## 6. セキュリティ

- service_role はサーバー専用。コミット・チャット・フロント禁止
- RLS 有効・anon policy なし（ブラウザから直接テーブル操作しない）
- 競馬用キー・URL を `.env.local` に残さない
