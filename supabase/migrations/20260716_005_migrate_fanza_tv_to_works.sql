-- Phase 7: work_live_status → works へ見放題判定を移行
-- 生成元: scripts/generate-fanza-tv-migrate-sql.mjs
-- 検出した work_live_status 列: cid, price, list_price, discount_rate, is_sale, sale_end_at, rating, review_count, popularity_rank, new_arrival_rank, is_available, fanza_tv_status, checked_at, updated_at
-- checked_at 式: l.checked_at
-- url 式: null

update public.works w
set
  fanza_tv_status = case
    when lower(coalesce(l.fanza_tv_status, '')) in ('available', 'active')
      then 'available'::public.fanza_tv_status_enum
    when lower(coalesce(l.fanza_tv_status, '')) in ('unavailable', 'not_available')
      then 'unavailable'::public.fanza_tv_status_enum
    else 'unknown'::public.fanza_tv_status_enum
  end,
  fanza_tv_checked_at = l.checked_at,
  fanza_tv_url = null,
  updated_at = now()
from public.work_live_status l
where w.cid = l.cid
  and l.fanza_tv_status is not null
  and lower(l.fanza_tv_status) in (
    'available',
    'active',
    'unavailable',
    'not_available',
    'unknown'
  );
