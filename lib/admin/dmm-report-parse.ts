import { randomUUID } from "crypto";
import type {
  DmmEntityKind,
  DmmEntityStat,
  DmmReportRow,
  DmmReportsDocument,
} from "@/lib/admin/dmm-report-types";

export class DmmReportParseError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DmmReportParseError";
    this.status = status;
  }
}

const DATE_ALIASES = ["date", "日付", "day", "ymd", "report_date"];
const CLICKS_ALIASES = ["clicks", "click", "クリック数", "クリック"];
const SALES_ALIASES = [
  "sales",
  "conversions",
  "orders",
  "成果件数",
  "成果数",
  "成果",
];
const REWARD_ALIASES = ["reward", "amount", "報酬", "報酬額", "売上"];
const CATEGORY_ALIASES = [
  "category_reward",
  "categoryReward",
  "カテゴリ成果",
  "カテゴリ報酬",
];
const DIRECT_ALIASES = [
  "direct_reward",
  "directReward",
  "ダイレクト成果",
  "ダイレクト報酬",
];
const RATE_ALIASES = [
  "conversion_rate",
  "conversionRate",
  "成果率",
  "cvr",
];
const CPC_ALIASES = ["cpc", "クリック単価", "click_unit_price"];
const CPA_ALIASES = ["cpa", "成果単価", "conversion_unit_price"];

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function aliasSet(aliases: string[]): Set<string> {
  return new Set(aliases.map(normalizeKey));
}

const DATE_SET = aliasSet(DATE_ALIASES);
const CLICKS_SET = aliasSet(CLICKS_ALIASES);
const SALES_SET = aliasSet(SALES_ALIASES);
const REWARD_SET = aliasSet(REWARD_ALIASES);
const CATEGORY_SET = aliasSet(CATEGORY_ALIASES);
const DIRECT_SET = aliasSet(DIRECT_ALIASES);
const RATE_SET = aliasSet(RATE_ALIASES);
const CPC_SET = aliasSet(CPC_ALIASES);
const CPA_SET = aliasSet(CPA_ALIASES);

function pickValue(
  record: Record<string, unknown>,
  aliases: Set<string>,
): unknown {
  for (const [key, value] of Object.entries(record)) {
    if (aliases.has(normalizeKey(key))) return value;
  }
  return undefined;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const cleaned = value
    .replace(/[,¥￥%\s]/g, "")
    .replace(/円/g, "")
    .trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const ymd = raw.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (ymd) {
    const year = ymd[1];
    const month = ymd[2].padStart(2, "0");
    const day = ymd[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function deriveMetrics(input: {
  clicks: number;
  sales: number;
  reward: number;
  conversion_rate?: number;
  cpc?: number;
  cpa?: number;
}): Pick<DmmReportRow, "conversion_rate" | "cpc" | "cpa"> {
  const conversion_rate =
    input.conversion_rate && input.conversion_rate > 0
      ? input.conversion_rate > 1
        ? input.conversion_rate / 100
        : input.conversion_rate
      : input.clicks > 0
        ? input.sales / input.clicks
        : 0;
  const cpc =
    input.cpc && input.cpc > 0
      ? input.cpc
      : input.clicks > 0
        ? input.reward / input.clicks
        : 0;
  const cpa =
    input.cpa && input.cpa > 0
      ? input.cpa
      : input.sales > 0
        ? input.reward / input.sales
        : 0;
  return { conversion_rate, cpc, cpa };
}

function rowFromRecord(
  record: Record<string, unknown>,
  nowIso: string,
): DmmReportRow | null {
  const date = normalizeDate(pickValue(record, DATE_SET));
  if (!date) return null;

  const clicks = toNumber(pickValue(record, CLICKS_SET));
  const sales = toNumber(pickValue(record, SALES_SET));
  const reward = toNumber(pickValue(record, REWARD_SET));
  const category_reward = toNumber(pickValue(record, CATEGORY_SET));
  const direct_reward = toNumber(pickValue(record, DIRECT_SET));
  const derived = deriveMetrics({
    clicks,
    sales,
    reward,
    conversion_rate: toNumber(pickValue(record, RATE_SET)),
    cpc: toNumber(pickValue(record, CPC_SET)),
    cpa: toNumber(pickValue(record, CPA_SET)),
  });

  return {
    id: randomUUID(),
    date,
    clicks,
    sales,
    reward,
    category_reward,
    direct_reward,
    conversion_rate: derived.conversion_rate,
    cpc: derived.cpc,
    cpa: derived.cpa,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

function parseEntityKind(value: unknown): DmmEntityKind | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["work", "作品", "content", "product"].includes(raw)) return "work";
  if (["genre", "ジャンル"].includes(raw)) return "genre";
  if (["actress", "女優", "cast"].includes(raw)) return "actress";
  if (["maker", "メーカー", "brand"].includes(raw)) return "maker";
  return null;
}

function entityFromRecord(record: Record<string, unknown>): DmmEntityStat | null {
  const kind =
    parseEntityKind(record.kind ?? record.type ?? record.entity_type) ?? null;
  if (!kind) return null;

  const name = String(
    record.name ?? record.label ?? record.title ?? record.key ?? "",
  ).trim();
  const key = String(record.key ?? record.id ?? name).trim();
  if (!key || !name) return null;

  const clicks = toNumber(record.clicks);
  const sales = toNumber(record.sales ?? record.conversions);
  const reward = toNumber(record.reward);
  return {
    kind,
    key,
    name,
    clicks,
    sales,
    reward,
    conversion_rate: clicks > 0 ? sales / clicks : 0,
  };
}

function extractRowArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  for (const key of ["daily", "reports", "dmm_reports", "rows", "data"]) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

function extractEntityArray(raw: unknown): unknown[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const obj = raw as Record<string, unknown>;
  for (const key of ["entities", "attributions", "breakdown", "items"]) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

export function parseDmmReportsJson(text: string): {
  rows: DmmReportRow[];
  entities: DmmEntityStat[];
} {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DmmReportParseError("JSONの形式が不正です。");
  }

  const nowIso = new Date().toISOString();
  const rows = extractRowArray(raw)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      return rowFromRecord(item as Record<string, unknown>, nowIso);
    })
    .filter((row): row is DmmReportRow => Boolean(row));

  if (rows.length === 0) {
    throw new DmmReportParseError(
      "JSONから成果行を読み取れませんでした。date/clicks/sales/reward を含む配列、または { daily: [...] } 形式にしてください。",
    );
  }

  const entities = extractEntityArray(raw)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      return entityFromRecord(item as Record<string, unknown>);
    })
    .filter((row): row is DmmEntityStat => Boolean(row));

  return { rows, entities };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function parseDmmReportsCsv(text: string): {
  rows: DmmReportRow[];
  entities: DmmEntityStat[];
} {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new DmmReportParseError("CSVにヘッダーとデータ行が必要です。");
  }

  const headers = parseCsvLine(lines[0]);
  const nowIso = new Date().toISOString();
  const rows: DmmReportRow[] = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    const row = rowFromRecord(record, nowIso);
    if (row) rows.push(row);
  }

  if (rows.length === 0) {
    throw new DmmReportParseError(
      "CSVから成果行を読み取れませんでした。日付・クリック数・成果件数・報酬の列名を確認してください。",
    );
  }

  return { rows, entities: [] };
}

export function createEmptyDmmReportsDocument(): DmmReportsDocument {
  return {
    version: 1,
    updatedAt: null,
    importedAt: null,
    source: null,
    fileName: null,
    rows: [],
    entities: [],
  };
}

export function parseDmmReportsDocument(text: string): DmmReportsDocument {
  const raw = JSON.parse(text) as Partial<DmmReportsDocument>;
  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    importedAt: typeof raw.importedAt === "string" ? raw.importedAt : null,
    source:
      raw.source === "json" ||
      raw.source === "csv" ||
      raw.source === "env" ||
      raw.source === "url"
        ? raw.source
        : null,
    fileName: typeof raw.fileName === "string" ? raw.fileName : null,
    rows: Array.isArray(raw.rows) ? (raw.rows as DmmReportRow[]) : [],
    entities: Array.isArray(raw.entities)
      ? (raw.entities as DmmEntityStat[])
      : [],
  };
}

export function serializeDmmReportsDocument(
  document: DmmReportsDocument,
): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

/** 同一 date は後勝ちで更新し、created_at は既存を維持 */
export function upsertDmmReportRows(
  existing: DmmReportRow[],
  incoming: DmmReportRow[],
): { rows: DmmReportRow[]; inserted: number; updated: number } {
  const map = new Map<string, DmmReportRow>();
  for (const row of existing) {
    map.set(row.date, row);
  }

  let inserted = 0;
  let updated = 0;

  for (const row of incoming) {
    const prev = map.get(row.date);
    if (prev) {
      map.set(row.date, {
        ...row,
        id: prev.id,
        created_at: prev.created_at,
        updated_at: row.updated_at,
      });
      updated += 1;
    } else {
      map.set(row.date, row);
      inserted += 1;
    }
  }

  const rows = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { rows, inserted, updated };
}

export function mergeEntityStats(
  existing: DmmEntityStat[],
  incoming: DmmEntityStat[],
): DmmEntityStat[] {
  if (incoming.length === 0) return existing;
  const map = new Map<string, DmmEntityStat>();
  for (const row of [...existing, ...incoming]) {
    const key = `${row.kind}:${row.key}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      continue;
    }
    const clicks = prev.clicks + row.clicks;
    const sales = prev.sales + row.sales;
    const reward = prev.reward + row.reward;
    map.set(key, {
      ...prev,
      name: row.name || prev.name,
      clicks,
      sales,
      reward,
      conversion_rate: clicks > 0 ? sales / clicks : 0,
    });
  }
  return [...map.values()];
}
