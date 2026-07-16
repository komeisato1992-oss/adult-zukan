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
-- 3/3  Phase6 CMS columns（手動非公開・FANZA TV 詳細）
-- -----------------------------------------------------------------------------
alter table public.works
  add column if not exists manual_hidden boolean not null default false;
alter table public.works
  add column if not exists manual_hidden_reason text;
alter table public.works
  add column if not exists deleted_at timestamptz;

alter table public.work_live_status
  add column if not exists manual_hidden boolean not null default false;
alter table public.work_live_status
  add column if not exists sale_start_at timestamptz;
alter table public.work_live_status
  add column if not exists fanza_tv_checked_at timestamptz;
alter table public.work_live_status
  add column if not exists fanza_tv_changed_at timestamptz;
alter table public.work_live_status
  add column if not exists fanza_tv_source text;
alter table public.work_live_status
  add column if not exists fanza_tv_error text;

-- -----------------------------------------------------------------------------
-- 4/4  Phase7 FANZA TV（見放題）判定結果 on works
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'fanza_tv_status_enum'
  ) then
    create type public.fanza_tv_status_enum as enum (
      'unknown',
      'available',
      'unavailable'
    );
  end if;
end $$;

alter table public.works
  add column if not exists fanza_tv_status public.fanza_tv_status_enum
    not null default 'unknown';
alter table public.works
  add column if not exists fanza_tv_checked_at timestamptz;
alter table public.works
  add column if not exists fanza_tv_url text;

create index if not exists works_fanza_tv_status_idx
  on public.works (fanza_tv_status);
create index if not exists works_fanza_tv_checked_at_idx
  on public.works (fanza_tv_checked_at desc nulls last);

-- -----------------------------------------------------------------------------
-- 5/5  パッケージ画像ステータス（追加・掲載情報更新時のみ判定）
-- -----------------------------------------------------------------------------
alter table public.works
  add column if not exists image_status text;
alter table public.works
  add column if not exists image_status_checked_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'works_image_status_check'
  ) then
    alter table public.works
      add constraint works_image_status_check
      check (
        image_status is null
        or image_status in ('ok', 'now_printing', 'fetch_failed')
      );
  end if;
end $$;

create index if not exists works_image_status_idx
  on public.works (image_status)
  where image_status is distinct from 'ok';

comment on column public.works.image_status is
  'Package image check result set only on add/update: ok | now_printing | fetch_failed.';
comment on column public.works.image_status_checked_at is
  'When image_status was last determined (add or listing sync).';

-- -----------------------------------------------------------------------------
-- 運用状況カード: 一括集計 RPC
-- -----------------------------------------------------------------------------
create or replace function public.works_cms_overview_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with works_agg as (
    select
      count(*)::bigint as total_count,
      count(*) filter (where published is true)::bigint as published_count,
      count(*) filter (where published is not true)::bigint as unpublished_count,
      count(*) filter (where manual_hidden is true)::bigint as manual_hidden_count,
      count(*) filter (
        where
          image_status in ('now_printing', 'fetch_failed')
          or (
            image_status is null
            and (
              package_image is null
              or btrim(package_image) = ''
              or package_image ilike '%now_printing%'
              or package_image ilike '%noimage%'
            )
          )
      )::bigint as no_image_count,
      count(*) filter (
        where
          published is true
          and (
            image_status in ('now_printing', 'fetch_failed')
            or (
              image_status is null
              and (
                package_image is null
                or btrim(package_image) = ''
                or package_image ilike '%now_printing%'
                or package_image ilike '%noimage%'
              )
            )
          )
      )::bigint as published_no_image_count,
      count(*) filter (where fanza_tv_status = 'available')::bigint as fanza_tv_available_count,
      count(*) filter (where fanza_tv_status = 'unavailable')::bigint as fanza_tv_unavailable_count,
      count(*) filter (
        where fanza_tv_status is null or fanza_tv_status = 'unknown'
      )::bigint as fanza_tv_unchecked_count,
      max(created_at) as last_work_added_at,
      max(fanza_tv_checked_at) as fanza_tv_last_checked_at
    from public.works
  ),
  live_agg as (
    select
      count(*)::bigint as live_status_count,
      count(*) filter (where is_available is false)::bigint as unavailable_count
    from public.work_live_status
  )
  select json_build_object(
    'total_count', w.total_count,
    'published_count', w.published_count,
    'unpublished_count', w.unpublished_count,
    'manual_hidden_count', w.manual_hidden_count,
    'no_image_count', w.no_image_count,
    'published_no_image_count', w.published_no_image_count,
    'works_master_count', w.total_count,
    'live_status_count', l.live_status_count,
    'unavailable_count', l.unavailable_count,
    'missing_live_count', greatest(w.total_count - l.live_status_count, 0),
    'fanza_tv_available_count', w.fanza_tv_available_count,
    'fanza_tv_unavailable_count', w.fanza_tv_unavailable_count,
    'fanza_tv_unchecked_count', w.fanza_tv_unchecked_count,
    'last_work_added_at', w.last_work_added_at,
    'fanza_tv_last_checked_at', w.fanza_tv_last_checked_at
  )
  from works_agg w
  cross join live_agg l;
$$;

revoke all on function public.works_cms_overview_stats() from public;
grant execute on function public.works_cms_overview_stats() to service_role;

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