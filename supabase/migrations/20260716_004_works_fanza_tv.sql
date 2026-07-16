-- Phase 7: FANZA TV（見放題）判定結果を works へ保存
-- 適用: Supabase Dashboard → SQL Editor で実行

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

comment on column public.works.fanza_tv_status is
  'FANZA TV見放題: unknown | available | unavailable（Playwright判定・JSON非更新）';
comment on column public.works.fanza_tv_checked_at is
  'FANZA TV見放題の最終判定日時';
comment on column public.works.fanza_tv_url is
  '判定時にアクセスした FANZA TV URL';
