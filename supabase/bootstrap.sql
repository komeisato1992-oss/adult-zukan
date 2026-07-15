-- =============================================================================
-- adult-zukan Supabase bootstrap（専用プロジェクト用・一括適用）
-- 適用先: アダルト図鑑専用プロジェクトのみ（競馬用プロジェクトには実行しない）
-- 手順: Supabase Dashboard → SQL Editor → New query → このファイル全文を実行
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1/2  work_live_status（変動情報: 価格・セール・評価・順位・販売状況）
-- -----------------------------------------------------------------------------
create table if not exists public.work_live_status (
  cid text primary key,
  price text,
  list_price text,
  discount_rate integer,
  is_sale boolean not null default false,
  sale_end_at timestamptz,
  rating numeric(4, 2),
  review_count integer,
  popularity_rank integer,
  new_arrival_rank integer,
  is_available boolean not null default true,
  fanza_tv_status text,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists work_live_status_updated_at_idx
  on public.work_live_status (updated_at desc);

create index if not exists work_live_status_is_sale_idx
  on public.work_live_status (is_sale)
  where is_sale = true;

create index if not exists work_live_status_popularity_rank_idx
  on public.work_live_status (popularity_rank)
  where popularity_rank is not null;

alter table public.work_live_status enable row level security;

-- 公開クライアント（anon）からの直接アクセスは行わない。
-- サーバーは service_role で RLS をバイパスして読み書きする。
drop policy if exists work_live_status_service_all on public.work_live_status;

comment on table public.work_live_status is
  'Adult catalog live fields (price/sale/rating/rank/availability).';

-- -----------------------------------------------------------------------------
-- 2/2  works（作品マスター: 固定メタデータ）
-- -----------------------------------------------------------------------------
create table if not exists public.works (
  cid text primary key,
  slug text not null,
  title text not null,
  description text,
  package_image text,
  sample_images jsonb not null default '[]'::jsonb,
  actresses jsonb not null default '[]'::jsonb,
  maker text,
  label text,
  series text,
  genres jsonb not null default '[]'::jsonb,
  release_date text,
  duration text,
  product_code text,
  affiliate_url text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists works_slug_uidx on public.works (slug);
create index if not exists works_published_updated_idx
  on public.works (published, updated_at desc);
create index if not exists works_release_date_idx
  on public.works (release_date desc nulls last);

alter table public.works enable row level security;

-- anon 直接アクセス禁止。service_role のみ想定。
drop policy if exists works_service_all on public.works;

comment on table public.works is
  'Adult work master (fixed metadata). Live price/sale/rating lives in work_live_status.';

-- -----------------------------------------------------------------------------
-- 確認用（実行結果で 2 行出ればOK）
-- -----------------------------------------------------------------------------
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('work_live_status', 'works')
  and c.relkind = 'r'
order by c.relname;
