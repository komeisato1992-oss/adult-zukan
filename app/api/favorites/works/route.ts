import { NextResponse } from "next/server";
import { getCatalogWorks } from "@/lib/catalog";
import { normalizeCatalogContentId } from "@/lib/dmm/catalog-snapshot";
import { isDisplayableListItem } from "@/lib/dmm/filter";
import type { DmmItem } from "@/lib/dmm/types";
import { mergeLiveStatusIntoItems } from "@/lib/dmm/work-live-status";

const MAX_IDS = 200;

function parseIds(body: unknown): string[] {
  if (!body || typeof body !== "object" || !("ids" in body)) return [];
  const raw = (body as { ids?: unknown }).ids;
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of raw) {
    const id = normalizeCatalogContentId(String(entry));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= MAX_IDS) break;
  }
  return ids;
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
    return NextResponse.json({ items: [] as DmmItem[] });
  }

  const catalog = await getCatalogWorks();
  const byId = new Map(
    catalog.map((item) => [normalizeCatalogContentId(item.content_id), item]),
  );
  const resolved = ids
    .map((id) => byId.get(id))
    .filter(
      (item): item is DmmItem => Boolean(item && isDisplayableListItem(item)),
    );

  const items = await mergeLiveStatusIntoItems(resolved);

  return NextResponse.json({ items });
}
