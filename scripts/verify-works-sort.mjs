#!/usr/bin/env node
/**
 * /works 各ソートの先頭件数を DB から直接確認する。
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function todayTokyo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  loadEnvLocal();
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const today = todayTokyo();
  const todayEnd = `${today} 23:59:59`;

  const priceColProbe = await sb
    .from("work_live_status")
    .select("price_amount")
    .limit(1);
  const priceCol = priceColProbe.error ? "new_arrival_rank" : "price_amount";
  console.log("price sort column:", priceCol, "today:", today);

  async function attachWorks(rows) {
    const cids = rows.map((r) => r.cid);
    const { data: works } = await sb
      .from("works")
      .select(
        "cid,title,release_date,created_at,duration,published",
      )
      .in("cid", cids)
      .eq("published", true)
      .or(`release_date.is.null,release_date.lte.${todayEnd}`);
    const map = new Map((works || []).map((w) => [w.cid, w]));
    return rows
      .map((r) => {
        const w = map.get(r.cid);
        if (!w) return null;
        return {
          cid: r.cid,
          title: (w.title || "").slice(0, 40),
          price: r.price,
          list_price: r.list_price,
          price_sort: r[priceCol] ?? r.new_arrival_rank ?? r.price_amount,
          popularity_rank: r.popularity_rank,
          release_date: w.release_date,
          created_at: w.created_at,
          rating: r.rating,
          review_count: r.review_count,
          discount_rate: r.discount_rate,
          duration: w.duration,
          published: w.published,
          is_available: r.is_available,
          is_sale: r.is_sale,
        };
      })
      .filter(Boolean)
      .slice(0, 5);
  }

  // popular
  {
    const { data } = await sb
      .from("work_live_status")
      .select(
        "cid,price,list_price,popularity_rank,rating,review_count,discount_rate,is_available,is_sale,new_arrival_rank",
      )
      .eq("is_available", true)
      .or("popularity_rank.gt.0,popularity_rank.is.null")
      .order("popularity_rank", { ascending: true, nullsFirst: false })
      .order("review_count", { ascending: false, nullsFirst: false })
      .limit(40);
    const top = await attachWorks(data || []);
    console.log("\n=== popular (top5) ===");
    console.table(top);
    const ranks = top.map((t) => t.popularity_rank);
    const ok = ranks.every(
      (r, i) => i === 0 || ranks[i - 1] == null || r == null || r >= ranks[i - 1],
    );
    console.log("rank ascending?", ok, ranks);
  }

  // price-asc
  {
    let q = sb
      .from("work_live_status")
      .select(
        `cid,price,list_price,popularity_rank,rating,review_count,discount_rate,is_available,is_sale,new_arrival_rank${priceCol === "price_amount" ? ",price_amount" : ""}`,
      )
      .eq("is_available", true)
      .gt(priceCol, 0)
      .order(priceCol, { ascending: true, nullsFirst: false })
      .order("popularity_rank", { ascending: true, nullsFirst: false })
      .limit(40);
    const { data } = await q;
    const top = await attachWorks(data || []);
    console.log("\n=== price-asc (top5) ===");
    console.table(top);
    const prices = top.map((t) => t.price_sort);
    const ok = prices.every((p, i) => i === 0 || p >= prices[i - 1]);
    console.log("price ascending?", ok, prices);
  }

  // price-desc
  {
    const { data } = await sb
      .from("work_live_status")
      .select(
        `cid,price,list_price,popularity_rank,rating,review_count,discount_rate,is_available,is_sale,new_arrival_rank${priceCol === "price_amount" ? ",price_amount" : ""}`,
      )
      .eq("is_available", true)
      .gt(priceCol, 0)
      .order(priceCol, { ascending: false, nullsFirst: false })
      .order("popularity_rank", { ascending: true, nullsFirst: false })
      .limit(40);
    const top = await attachWorks(data || []);
    console.log("\n=== price-desc (top5) ===");
    console.table(top);
    const prices = top.map((t) => t.price_sort);
    const ok = prices.every((p, i) => i === 0 || p <= prices[i - 1]);
    console.log("price descending?", ok, prices);
  }

  // release-new
  {
    const { data } = await sb
      .from("works")
      .select("cid,title,release_date,created_at,duration,published")
      .eq("published", true)
      .or("image_status.eq.ok,image_status.is.null")
      .or(`release_date.is.null,release_date.lte.${todayEnd}`)
      .order("release_date", { ascending: false, nullsFirst: false })
      .limit(5);
    console.log("\n=== release-new (top5) ===");
    console.table(
      (data || []).map((w) => ({
        cid: w.cid,
        title: (w.title || "").slice(0, 40),
        release_date: w.release_date,
        created_at: w.created_at,
      })),
    );
  }

  // added
  {
    const { data } = await sb
      .from("works")
      .select("cid,title,release_date,created_at,published")
      .eq("published", true)
      .or("image_status.eq.ok,image_status.is.null")
      .or(`release_date.is.null,release_date.lte.${todayEnd}`)
      .order("created_at", { ascending: false })
      .limit(5);
    console.log("\n=== added (top5) ===");
    console.table(
      (data || []).map((w) => ({
        cid: w.cid,
        title: (w.title || "").slice(0, 40),
        created_at: w.created_at,
        release_date: w.release_date,
      })),
    );
  }

  // rating
  {
    const { data } = await sb
      .from("work_live_status")
      .select(
        "cid,price,list_price,popularity_rank,rating,review_count,discount_rate,is_available,is_sale,new_arrival_rank",
      )
      .eq("is_available", true)
      .gt("review_count", 0)
      .not("rating", "is", null)
      .order("rating", { ascending: false, nullsFirst: false })
      .order("review_count", { ascending: false, nullsFirst: false })
      .limit(40);
    const top = await attachWorks(data || []);
    console.log("\n=== rating (top5) ===");
    console.table(top);
  }

  // discount
  {
    const { data } = await sb
      .from("work_live_status")
      .select(
        "cid,price,list_price,popularity_rank,rating,review_count,discount_rate,is_available,is_sale,new_arrival_rank",
      )
      .eq("is_available", true)
      .eq("is_sale", true)
      .gt("discount_rate", 0)
      .order("discount_rate", { ascending: false, nullsFirst: false })
      .order(priceCol, { ascending: true, nullsFirst: false })
      .limit(40);
    const top = await attachWorks(data || []);
    console.log("\n=== discount (top5) ===");
    console.table(top);
  }

  // duration-desc
  {
    const { data } = await sb
      .from("works")
      .select("cid,title,release_date,created_at,duration,published")
      .eq("published", true)
      .or("image_status.eq.ok,image_status.is.null")
      .or(`release_date.is.null,release_date.lte.${todayEnd}`)
      .not("duration", "is", null)
      .order("duration", { ascending: false, nullsFirst: false })
      .limit(5);
    console.log("\n=== duration-desc (top5) ===");
    console.table(
      (data || []).map((w) => ({
        cid: w.cid,
        title: (w.title || "").slice(0, 40),
        duration: w.duration,
        release_date: w.release_date,
      })),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
