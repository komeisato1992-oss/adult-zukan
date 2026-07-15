-- 001: work_live_status（変動情報）
-- 適用順: 1（works より先）

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

drop policy if exists work_live_status_service_all on public.work_live_status;

comment on table public.work_live_status is
  'Adult catalog live fields (price/sale/rating/rank/availability).';
