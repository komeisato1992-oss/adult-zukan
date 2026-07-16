-- 007: 運用状況カード用の一括集計 RPC（COUNT を何度も飛ばさない）
-- Supabase SQL Editor で適用してください。

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

comment on function public.works_cms_overview_stats() is
  'Admin works CMS overview counters in a single SQL round-trip.';
