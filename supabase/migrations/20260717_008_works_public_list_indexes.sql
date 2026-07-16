-- 公開一覧のページング用インデックス（必要最小限）
-- 注意: manual_hidden / deleted_at 未適用環境でも動く定義にする

create index if not exists works_published_release_date_idx
  on public.works (release_date desc nulls last)
  where published = true;

create index if not exists works_published_created_at_idx
  on public.works (created_at desc)
  where published = true;

create index if not exists works_published_image_status_idx
  on public.works (image_status)
  where published = true;

create index if not exists works_published_maker_idx
  on public.works (maker)
  where published = true
    and maker is not null;

-- 人気順・セール順（work_live_status）
create index if not exists work_live_status_sale_discount_idx
  on public.work_live_status (discount_rate desc nulls last)
  where is_sale = true
    and is_available = true;

create index if not exists work_live_status_available_popularity_idx
  on public.work_live_status (popularity_rank asc nulls last)
  where popularity_rank is not null
    and is_available = true;
