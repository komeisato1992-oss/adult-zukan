import type {
  DmmReportsDocument,
  DmmRewardRow,
  DmmRewardType,
} from "@/lib/admin/dmm-report-types";

export class DmmReportParseError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DmmReportParseError";
    this.status = status;
  }
}

const DATE_ALIASES = new Set(
  ["date", "日付", "day", "ymd", "report_date"].map(normalizeKey),
);
const COUNT_ALIASES = new Set(
  ["count", "報酬件数", "成果件数", "件数", "成果数"].map(normalizeKey),
);
const SALES_ALIASES = new Set(
  ["sales", "販売金額", "売上", "売上金額"].map(normalizeKey),
);
const REWARD_ALIASES = new Set(
  ["reward", "報酬額", "報酬", "amount"].map(normalizeKey),
);

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

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
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const ymd = raw.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  }

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }

  return null;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

/** UTF-8 / Shift_JIS 両対応でCSVテキストを復元 */
export function decodeDmmCsvBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (
    utf8.includes("日付") ||
    utf8.includes("報酬") ||
    utf8.toLowerCase().includes("date")
  ) {
    return utf8.replace(/^\uFEFF/, "");
  }

  try {
    const sjis = new TextDecoder("shift_jis", { fatal: false }).decode(bytes);
    if (sjis.includes("日付") || sjis.includes("報酬")) {
      return sjis.replace(/^\uFEFF/, "");
    }
  } catch {
    // ignore
  }

  return utf8.replace(/^\uFEFF/, "");
}

export function resolveDmmRewardType(input: {
  type?: string | null;
  fileName?: string | null;
}): DmmRewardType {
  const explicit = (input.type ?? "").trim().toLowerCase();
  if (explicit === "direct" || explicit === "category") {
    return explicit;
  }

  const raw = `${input.fileName ?? ""}`.toLowerCase();
  if (raw.includes("direct") || raw.includes("ダイレクト")) {
    return "direct";
  }
  if (raw.includes("category") || raw.includes("カテゴリ")) {
    return "category";
  }
  throw new DmmReportParseError(
    "CSV種別を指定してください（カテゴリCSV / ダイレクトCSV）。",
  );
}

export function parseDmmRewardCsv(
  text: string,
  type: DmmRewardType,
): DmmRewardRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new DmmReportParseError("CSVにデータ行がありません。");
  }

  const headers = splitCsvLine(lines[0]);
  const headerRecord = Object.fromEntries(
    headers.map((header, index) => [header, header]),
  );

  if (
    pickValue(headerRecord, DATE_ALIASES) == null ||
    pickValue(headerRecord, COUNT_ALIASES) == null ||
    pickValue(headerRecord, SALES_ALIASES) == null ||
    pickValue(headerRecord, REWARD_ALIASES) == null
  ) {
    throw new DmmReportParseError(
      "CSVヘッダーに「日付」「報酬件数」「販売金額」「報酬額」が必要です。",
    );
  }

  const rows: DmmRewardRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });

    const date = normalizeDate(pickValue(record, DATE_ALIASES));
    if (!date) continue;

    rows.push({
      date,
      type,
      count: toNumber(pickValue(record, COUNT_ALIASES)),
      sales: toNumber(pickValue(record, SALES_ALIASES)),
      reward: toNumber(pickValue(record, REWARD_ALIASES)),
    });
  }

  if (rows.length === 0) {
    throw new DmmReportParseError("有効な日付行をCSVから読み取れませんでした。");
  }

  return rows;
}

export function createEmptyDmmReportsDocument(): DmmReportsDocument {
  return {
    version: 2,
    updatedAt: null,
    importedAt: null,
    source: null,
    fileName: null,
    rows: [],
  };
}

function migrateLegacyRows(rawRows: unknown[]): DmmRewardRow[] {
  const migrated: DmmRewardRow[] = [];
  for (const raw of rawRows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const date = normalizeDate(row.date);
    if (!date) continue;

    if (row.type === "category" || row.type === "direct") {
      migrated.push({
        date,
        type: row.type,
        sales: toNumber(row.sales),
        reward: toNumber(row.reward),
        count: toNumber(row.count ?? row.sales),
      });
      continue;
    }

    // 旧形式: 1日1行に category_reward / direct_reward
    const categoryReward = toNumber(row.category_reward ?? row.categoryReward);
    const directReward = toNumber(row.direct_reward ?? row.directReward);
    const totalReward = toNumber(row.reward);
    const count = toNumber(row.sales ?? row.count);
    const sales = toNumber(row.clicks) === 0 ? toNumber(row.sales) : 0;

    if (categoryReward > 0 || (totalReward > 0 && directReward === 0)) {
      migrated.push({
        date,
        type: "category",
        sales,
        reward: categoryReward || totalReward,
        count,
      });
    }
    if (directReward > 0) {
      migrated.push({
        date,
        type: "direct",
        sales: 0,
        reward: directReward,
        count: 0,
      });
    }
  }
  return migrated;
}

export function parseDmmReportsDocument(text: string): DmmReportsDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DmmReportParseError("DMM成果JSONの解析に失敗しました。", 500);
  }

  if (!parsed || typeof parsed !== "object") {
    return createEmptyDmmReportsDocument();
  }

  const raw = parsed as Record<string, unknown>;
  const rows = Array.isArray(raw.rows) ? migrateLegacyRows(raw.rows) : [];

  return {
    version: 2,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    importedAt: typeof raw.importedAt === "string" ? raw.importedAt : null,
    source: raw.source === "csv" ? "csv" : null,
    fileName: typeof raw.fileName === "string" ? raw.fileName : null,
    rows,
  };
}

export function serializeDmmReportsDocument(
  document: DmmReportsDocument,
): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function upsertDmmRewardRows(
  existing: DmmRewardRow[],
  incoming: DmmRewardRow[],
): { rows: DmmRewardRow[]; inserted: number; updated: number } {
  const map = new Map<string, DmmRewardRow>();
  for (const row of existing) {
    map.set(`${row.date}::${row.type}`, row);
  }

  let inserted = 0;
  let updated = 0;
  for (const row of incoming) {
    const key = `${row.date}::${row.type}`;
    if (map.has(key)) {
      updated += 1;
    } else {
      inserted += 1;
    }
    map.set(key, row);
  }

  const rows = Array.from(map.values()).sort((a, b) =>
    a.date === b.date
      ? a.type.localeCompare(b.type)
      : a.date.localeCompare(b.date),
  );

  return { rows, inserted, updated };
}

/** @deprecated */
export function mergeEntityStats() {
  return [];
}
