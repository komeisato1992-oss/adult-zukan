-- 003: Phase 6 CMS — 公開制御・FANZA TV 拡張カラム
-- 適用順: 3（works / work_live_status の後）

-- works: 手動非公開・論理削除
alter table public.works
  add column if not exists manual_hidden boolean not null default false;

alter table public.works
  add column if not exists manual_hidden_reason text;

alter table public.works
  add column if not exists deleted_at timestamptz;

create index if not exists works_manual_hidden_idx
  on public.works (manual_hidden)
  where manual_hidden = true;

create index if not exists works_deleted_at_idx
  on public.works (deleted_at)
  where deleted_at is not null;

create index if not exists works_package_image_null_idx
  on public.works (cid)
  where package_image is null or package_image = '';

-- work_live_status: FANZA TV 詳細・手動非公開ミラー
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

create index if not exists work_live_status_fanza_tv_status_idx
  on public.work_live_status (fanza_tv_status);

create index if not exists work_live_status_manual_hidden_idx
  on public.work_live_status (manual_hidden)
  where manual_hidden = true;

comment on column public.works.manual_hidden is
  'Manual hide override. published requires package_image AND is_available AND NOT manual_hidden.';
comment on column public.work_live_status.fanza_tv_status is
  'active | not_available | unknown (no official FANZA TV API; local URL/Playwright only).';
