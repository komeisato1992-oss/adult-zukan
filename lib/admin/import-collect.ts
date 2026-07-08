import "server-only";

import { fetchDmmItemList, isDmmConfigured } from "@/lib/dmm/client";
import { readCatalogSnapshot } from "@/lib/dmm/catalog-snapshot";
import { isValidDmmListItem } from "@/lib/dmm/filter";
import {
  getDmmItemActressNameList,
  getDmmItemImageUrl,
} from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";
import { parseDmmPrice } from "@/lib/utils";
import {
  appendImportCandidates,
  getImportCandidateIdSet,
  loadImportCandidates,
} from "@/lib/admin/import-candidates-store";
import { dmmItemToStoredCandidate } from "@/lib/admin/import-candidate-mapper";
import { buildImportCandidatesListFromRecords } from "@/lib/admin/import-candidates-query";
import type { ImportCandidatesListResult } from "@/lib/admin/import-candidate-types";
import { IMPORT_COLLECT_MAX } from "@/lib/admin/import-constants";

type CollectFetchSpec = {
  sort: "date" | "rank" | "price";
  hits: number;
  offset: number;
  source: string;
  saleOnly?: boolean;
};

const COLLECT_FETCH_SPECS: CollectFetchSpec[] = [
  { sort: "date", hits: 100, offset: 1, source: "fanza-new" },
  { sort: "rank", hits: 100, offset: 1, source: "fanza-rank" },
  { sort: "price", hits: 100, offset: 1, source: "fanza-price" },
  { sort: "date", hits: 100, offset: 101, source: "fanza-new-page2" },
  { sort: "rank", hits: 100, offset: 201, source: "fanza-rank-page3" },
];

const GENRE_KEYWORDS = ["単体", "人妻", "NTR", "巨乳", "素人"];

function shuffleItems<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function isDmmItemOnSale(item: DmmItem): boolean {
  const price = parseDmmPrice(item.prices?.price);
  const listPrice = parseDmmPrice(item.prices?.list_price);
  return listPrice > 0 && price > 0 && price < listPrice;
}

function isCollectibleItem(item: DmmItem): boolean {
  if (!isValidDmmListItem(item)) return false;
  if (getDmmItemActressNameList(item).length === 0) return false;
  if (!getDmmItemImageUrl(item)) return false;
  return true;
}

function getExistingCatalogIds(): Set<string> {
  return new Set(
    readCatalogSnapshot()
      .map((item) => item.content_id.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function fetchCollectPool(
  spec: CollectFetchSpec,
): Promise<Array<{ item: DmmItem; source: string }>> {
  const response = await fetchDmmItemList({
    sort: spec.sort,
    hits: spec.hits,
    offset: spec.offset,
    cache: "no-store",
  });

  let items = response.result.items.filter(isCollectibleItem);

  if (spec.saleOnly) {
    items = items.filter(isDmmItemOnSale);
  }

  return items.map((item) => ({ item, source: spec.source }));
}

async function fetchGenrePool(): Promise<Array<{ item: DmmItem; source: string }>> {
  const keyword = GENRE_KEYWORDS[Math.floor(Math.random() * GENRE_KEYWORDS.length)];
  const offset = 1 + Math.floor(Math.random() * 4) * 100;

  const response = await fetchDmmItemList({
    sort: "rank",
    hits: 100,
    offset,
    keyword,
    cache: "no-store",
  });

  return response.result.items
    .filter(isCollectibleItem)
    .map((item) => ({ item, source: `fanza-genre-${keyword}` }));
}

export type CollectImportCandidatesResult = {
  success: boolean;
  configured: boolean;
  collectedCount: number;
  displayedCount: number;
  message: string;
} & ImportCandidatesListResult;

export async function collectImportCandidates(): Promise<CollectImportCandidatesResult> {
  if (!isDmmConfigured()) {
    const emptyList = buildImportCandidatesListFromRecords([]);
    return {
      success: false,
      configured: false,
      collectedCount: 0,
      displayedCount: 0,
      message: "DMM API の認証情報が未設定です（DMM_API_ID / DMM_AFFILIATE_ID）。",
      ...emptyList,
    };
  }

  const catalogIds = getExistingCatalogIds();
  const { records: existingRecords } = await loadImportCandidates();
  const knownIds = getImportCandidateIdSet(existingRecords);
  const blockedIds = new Set([...catalogIds, ...knownIds]);

  const rankSpec = COLLECT_FETCH_SPECS.find((spec) => spec.sort === "rank");
  if (rankSpec) {
    rankSpec.offset = 1 + Math.floor(Math.random() * 5) * 100;
  }

  const saleSpec: CollectFetchSpec = {
    sort: "rank",
    hits: 100,
    offset: 1 + Math.floor(Math.random() * 3) * 100,
    source: "fanza-sale",
    saleOnly: true,
  };

  const fetchTasks = [
    ...COLLECT_FETCH_SPECS.map((spec) => fetchCollectPool(spec)),
    fetchCollectPool(saleSpec),
    fetchGenrePool(),
  ];

  const pools = await Promise.all(fetchTasks);
  const merged = shuffleItems(pools.flat());

  const selected: ReturnType<typeof dmmItemToStoredCandidate>[] = [];
  const batchIds = new Set<string>();

  for (const entry of merged) {
    const id = entry.item.content_id.trim().toLowerCase();
    if (!id || blockedIds.has(id) || batchIds.has(id)) continue;

    batchIds.add(id);
    selected.push(dmmItemToStoredCandidate(entry.item, entry.source));

    if (selected.length >= IMPORT_COLLECT_MAX) {
      break;
    }
  }

  if (selected.length === 0) {
    const list = buildImportCandidatesListFromRecords(existingRecords, {
      page: 1,
    });
    return {
      success: true,
      configured: true,
      collectedCount: 0,
      displayedCount: list.pagination.totalCount,
      message: "新しい未掲載候補が見つかりませんでした。",
      ...list,
    };
  }

  const { addedCount, records } = await appendImportCandidates(selected);
  const list = buildImportCandidatesListFromRecords(records, { page: 1 });
  const displayedCount = list.summary.candidateCount;

  return {
    success: true,
    configured: true,
    collectedCount: addedCount,
    displayedCount,
    message:
      displayedCount > 0
        ? `${displayedCount}件の候補を表示しました。`
        : addedCount > 0
          ? `${addedCount}件を保存しましたが、一覧に反映できる候補がありません。`
          : "新しい未掲載候補が見つかりませんでした（重複のため保存されませんでした）。",
    ...list,
  };
}
