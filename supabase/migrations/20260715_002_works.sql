-- 002: works（作品マスター）
-- 適用順: 2（work_live_status の後）

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

drop policy if exists works_service_all on public.works;

comment on table public.works is
  'Adult work master (fixed metadata). Live price/sale/rating lives in work_live_status.';
