-- 公開一覧ソート用: 数値価格・再生時間・RPC
-- 適用: Supabase SQL Editor で実行

-- 現在販売価格（表示用 price テキストから正規化した整数）
alter table public.work_live_status
  add column if not exists price_amount integer;

comment on column public.work_live_status.price_amount is
  'Current sell price as integer yen for sorting. Null/0 = unknown.';

-- 再生時間（分）
alter table public.works
  add column if not exists duration_minutes integer;

comment on column public.works.duration_minutes is
  'Duration in minutes for sorting. Null/0 = unknown.';

-- 既存テキストからバックフィル
update public.work_live_status
set price_amount = nullif(
  (nullif(regexp_replace(coalesce(price, ''), '[^0-9]', '', 'g'), ''))::integer,
  0
)
where price is not null
  and (
    price_amount is null
    or price_amount is distinct from nullif(
      (nullif(regexp_replace(coalesce(price, ''), '[^0-9]', '', 'g'), ''))::integer,
      0
    )
  );

update public.works
set duration_minutes = nullif(
  (nullif(regexp_replace(coalesce(duration, ''), '[^0-9]', '', 'g'), ''))::integer,
  0
)
where duration is not null
  and (
    duration_minutes is null
    or duration_minutes is distinct from nullif(
      (nullif(regexp_replace(coalesce(duration, ''), '[^0-9]', '', 'g'), ''))::integer,
      0
    )
  );

create index if not exists work_live_status_price_amount_asc_idx
  on public.work_live_status (price_amount asc nulls last, popularity_rank asc nulls last)
  where is_available = true and price_amount is not null and price_amount > 0;

create index if not exists work_live_status_price_amount_desc_idx
  on public.work_live_status (price_amount desc nulls last, popularity_rank asc nulls last)
  where is_available = true and price_amount is not null and price_amount > 0;

create index if not exists work_live_status_rating_idx
  on public.work_live_status (rating desc nulls last, review_count desc nulls last)
  where is_available = true and review_count is not null and review_count > 0;

create index if not exists works_duration_minutes_idx
  on public.works (duration_minutes desc nulls last)
  where published = true and duration_minutes is not null and duration_minutes > 0;

-- 公開一覧1ページ分（ソート・公開条件・ページングを DB 側で実行）
create or replace function public.fetch_public_works_list_page(
  p_sort text default 'popular',
  p_offset integer default 0,
  p_limit integer default 20,
  p_sale_only boolean default false,
  p_seed text default null
)
returns table (
  cid text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today text := (timezone('Asia/Tokyo', now()))::date::text;
  v_sort text := coalesce(nullif(trim(p_sort), ''), 'popular');
  v_seed text := coalesce(nullif(trim(p_seed), ''), v_today);
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_limit integer := least(100, greatest(1, coalesce(p_limit, 20)));
begin
  return query
  with base as (
    select
      w.cid,
      w.release_date,
      w.created_at,
      w.duration_minutes,
      l.price_amount,
      l.popularity_rank,
      l.rating,
      l.review_count,
      l.discount_rate,
      l.is_sale,
      l.sale_end_at
    from public.works w
    inner join public.work_live_status l on l.cid = w.cid
    where w.published = true
      and (w.image_status = 'ok' or w.image_status is null)
      and l.is_available = true
      and (w.release_date is null or left(w.release_date, 10) <= v_today)
      and (
        not p_sale_only
        or (
          l.is_sale = true
          and coalesce(l.discount_rate, 0) > 0
          and (l.sale_end_at is null or l.sale_end_at > now())
        )
      )
  ),
  ordered as (
    select
      b.cid,
      count(*) over() as total_count,
      row_number() over (
        order by
          case
            when v_sort = 'popular' then
              case when b.popularity_rank is null or b.popularity_rank <= 0 then 1 else 0 end
            when v_sort in ('price-asc', 'price-desc') then
              case when b.price_amount is null or b.price_amount <= 0 then 1 else 0 end
            when v_sort = 'rating' then
              case when b.review_count is null or b.review_count <= 0 or b.rating is null then 1 else 0 end
            when v_sort in ('discount', 'discount-desc') then
              case when b.discount_rate is null or b.discount_rate <= 0 then 1 else 0 end
            when v_sort = 'duration-desc' then
              case when b.duration_minutes is null or b.duration_minutes <= 0 then 1 else 0 end
            when v_sort in ('release-new', 'release-desc', 'new') then
              case when b.release_date is null then 1 else 0 end
            else 0
          end asc,
          case when v_sort = 'popular' then b.popularity_rank end asc nulls last,
          case when v_sort = 'popular' then b.review_count end desc nulls last,
          case when v_sort = 'popular' then b.rating end desc nulls last,
          case when v_sort = 'popular' then b.release_date end desc nulls last,
          case when v_sort = 'price-asc' then b.price_amount end asc nulls last,
          case when v_sort = 'price-desc' then b.price_amount end desc nulls last,
          case when v_sort in ('price-asc', 'price-desc') then b.popularity_rank end asc nulls last,
          case when v_sort in ('price-asc', 'price-desc') then b.release_date end desc nulls last,
          case when v_sort = 'rating' then b.rating end desc nulls last,
          case when v_sort = 'rating' then b.review_count end desc nulls last,
          case when v_sort = 'rating' then b.popularity_rank end asc nulls last,
          case when v_sort in ('discount', 'discount-desc') then b.discount_rate end desc nulls last,
          case when v_sort in ('discount', 'discount-desc') then b.price_amount end asc nulls last,
          case when v_sort in ('release-new', 'release-desc', 'new') then b.release_date end desc nulls last,
          case when v_sort = 'added' then b.created_at end desc nulls last,
          case when v_sort = 'duration-desc' then b.duration_minutes end desc nulls last,
          case when v_sort = 'random' then md5(b.cid || v_seed) end asc,
          b.cid asc
      ) as rn
    from base b
    where
      v_sort not in ('discount', 'discount-desc')
      or (
        b.is_sale = true
        and coalesce(b.discount_rate, 0) > 0
        and (b.sale_end_at is null or b.sale_end_at > now())
      )
  )
  select o.cid, o.total_count
  from ordered o
  where o.rn > v_offset
    and o.rn <= v_offset + v_limit
  order by o.rn;
end;
$$;

revoke all on function public.fetch_public_works_list_page(text, integer, integer, boolean, text) from public;
grant execute on function public.fetch_public_works_list_page(text, integer, integer, boolean, text) to service_role;
