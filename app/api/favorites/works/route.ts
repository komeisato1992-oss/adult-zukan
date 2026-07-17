import { NextResponse } from "next/server";
import { getCatalogWorkById } from "@/lib/dmm/catalog-shards";
import { hydrateAdultWorkMedia } from "@/lib/dmm/catalog-media";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { getDmmListItemImageUrl } from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";
import { mergeLiveStatusIntoItems } from "@/lib/dmm/work-live-status";
import {
  fetchWorkMasterByCids,
  workMasterRowToDmmItem,
} from "@/lib/dmm/works-master";
import { hasValidImage } from "@/lib/works";

const MAX_IDS = 200;

function parseIds(body: unknown): string[] {
  if (!body || typeof body !== "object" || !("ids" in body)) return [];
  const raw = (body as { ids?: unknown }).ids;
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of raw) {
    const id = String(entry ?? "").trim();
    if (!id) continue;
    const key = normalizeCatalogContentId(id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ids.push(id);
    if (ids.length >= MAX_IDS) break;
  }
  return ids;
}

function canShowFavoriteCard(item: DmmItem): boolean {
  if (!item.content_id?.trim() || !item.title?.trim()) return false;
  return hasValidImage(item) || Boolean(getDmmListItemImageUrl(item));
}

async function resolveOne(id: string): Promise<DmmItem | null> {
  try {
    const fromCatalog = getCatalogWorkById(id);
    if (fromCatalog && canShowFavoriteCard(fromCatalog)) {
      return hydrateAdultWorkMedia(fromCatalog);
    }

    const cid = normalizeCatalogContentId(id);
    if (!cid) return null;

    const masterMap = await fetchWorkMasterByCids([cid]);
    const row = masterMap.get(cid);
    if (!row) {
      if (fromCatalog) {
        // 画像判定に落ちてもカタログにあれば返す（お気に入りはユーザー意図を優先）
        return hydrateAdultWorkMedia(fromCatalog);
      }
      console.warn("[favorites/works] unresolved id", id);
      return null;
    }

    const fromMaster = workMasterRowToDmmItem(row);
    if (!canShowFavoriteCard(fromMaster) && !fromCatalog) {
      console.warn("[favorites/works] unresolved id (no card media)", id);
      return null;
    }

    return hydrateAdultWorkMedia(fromMaster);
  } catch (error) {
    console.warn("[favorites/works] resolve failed", id, error);
    return null;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids = parseIds(body);
  if (ids.length === 0) {
    return NextResponse.json({
      items: [] as DmmItem[],
      requestedCount: 0,
      missingIds: [] as string[],
    });
  }

  const settled = await Promise.allSettled(ids.map((id) => resolveOne(id)));
  const resolved: DmmItem[] = [];
  const missingIds: string[] = [];
  const seenContentIds = new Set<string>();

  for (let index = 0; index < ids.length; index++) {
    const id = ids[index];
    const result = settled[index];
    if (result.status !== "fulfilled" || !result.value) {
      missingIds.push(id);
      continue;
    }

    const item = result.value;
    const key = normalizeCatalogContentId(item.content_id);
    if (!key || seenContentIds.has(key)) {
      // 別IDが同一作品に解決された場合は件数として欠落扱いにしない
      continue;
    }
    seenContentIds.add(key);
    resolved.push(item);
  }

  const items = await mergeLiveStatusIntoItems(resolved);

  return NextResponse.json({
    items,
    requestedCount: ids.length,
    missingIds,
  });
}
