-- 006: works.image_status — 追加・掲載情報更新時のみ取得判定した結果
-- ok | now_printing | fetch_failed

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
