import type { DmmItem } from "@/lib/dmm/types";

export type ParsedActressEntry = {
  name: string;
  ruby?: string;
};

function warnInvalidActressField(
  contentId: string,
  value: unknown,
  error?: unknown,
): void {
  const reason =
    error instanceof Error
      ? error.message
      : `unsupported actress value type: ${typeof value}`;
  console.warn(
    `[actress-names] skipped actress data for ${contentId}: ${reason}`,
  );
}

export function iterateItemActresses(item: DmmItem): ParsedActressEntry[] {
  const results: ParsedActressEntry[] = [];
  const raw = item.actress ?? item.iteminfo?.actress;

  if (raw == null) {
    return results;
  }

  const entries: unknown[] = Array.isArray(raw) ? raw : [raw];

  for (const entry of entries) {
    try {
      if (typeof entry === "string") {
        const name = entry.trim();
        if (name) {
          results.push({ name });
        }
        continue;
      }

      if (entry && typeof entry === "object") {
        const record = entry as { name?: unknown; ruby?: unknown };
        const name = String(record.name ?? "").trim();
        if (!name) {
          continue;
        }

        const ruby =
          typeof record.ruby === "string" ? record.ruby.trim() : undefined;
        results.push({ name, ruby: ruby || undefined });
        continue;
      }

      warnInvalidActressField(item.content_id, entry);
    } catch (error) {
      warnInvalidActressField(item.content_id, entry, error);
    }
  }

  return results;
}

export function getActressNamesFromItem(item: DmmItem): string[] {
  return iterateItemActresses(item).map((actress) => actress.name);
}
