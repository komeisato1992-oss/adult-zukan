import { AddWorkValidationError } from "@/lib/admin/add-work";
import { resolveBulkAddLimit } from "@/lib/admin/bulk-add-limit";
import { IMPORT_BULK_ADD_ABSOLUTE_MAX } from "@/lib/admin/import-constants";
import type { DmmItem } from "@/lib/dmm/types";

export type BulkAddWorkInput = {
  contentId: string;
  item: DmmItem;
};

type BulkAddRequestBody = {
  selectedWorks?: Array<{ contentId?: string; item?: DmmItem }>;
  works?: Array<{ contentId?: string; item?: DmmItem }>;
  addLimit?: number | string;
};

function parseWorkEntries(
  entries: Array<{ contentId?: string; item?: DmmItem }>,
): BulkAddWorkInput[] {
  return entries.map((entry, index) => {
    const contentId = entry.contentId?.trim();
    const item = entry.item;

    if (!contentId || !item || typeof item !== "object") {
      throw new AddWorkValidationError(`作品データ(${index + 1}件目)が不正です。`);
    }

    return { contentId, item };
  });
}

export function parseBulkAddRequestBody(
  body: unknown,
  worksKey: "selectedWorks" | "works" = "selectedWorks",
): { works: BulkAddWorkInput[]; appliedLimit: number } {
  if (!body || typeof body !== "object") {
    throw new AddWorkValidationError("リクエスト形式が不正です。");
  }

  const payload = body as BulkAddRequestBody;
  const rawWorks = worksKey === "works" ? payload.works : payload.selectedWorks;

  if (!Array.isArray(rawWorks) || rawWorks.length === 0) {
    throw new AddWorkValidationError("追加する作品が選択されていません。");
  }

  const parsedWorks = parseWorkEntries(rawWorks);
  const appliedLimit = resolveBulkAddLimit(payload.addLimit, parsedWorks.length);
  const works = parsedWorks.slice(0, appliedLimit);

  if (works.length > IMPORT_BULK_ADD_ABSOLUTE_MAX) {
    throw new AddWorkValidationError(
      `1回で追加できるのは${IMPORT_BULK_ADD_ABSOLUTE_MAX}件までです`,
    );
  }

  return { works, appliedLimit };
}
