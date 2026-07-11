import "server-only";

import { resolveBulkAddLimit } from "@/lib/admin/bulk-add-limit";
import type { BulkAddWorkInput } from "@/lib/admin/bulk-add-request";
import type { ImportCandidateSortKey } from "@/lib/admin/import-candidate-types";
import { buildImportCandidatesListFromRecords } from "@/lib/admin/import-candidates-query";
import { loadImportCandidates } from "@/lib/admin/import-candidates-store";
import { storedRecordToListItem } from "@/lib/admin/import-candidates-visibility";
import { IMPORT_BULK_ADD_ABSOLUTE_MAX } from "@/lib/admin/import-constants";
import type { BulkAddSelectionRequest } from "@/lib/admin/import-selection";
import type { ImportFilterKey } from "@/lib/admin/import-quality";
import { AddWorkValidationError } from "@/lib/admin/add-work";
import type { DmmItem } from "@/lib/dmm/types";

function parseExplicitWorks(
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

async function resolveAllMatchingWorks(input: {
  excludedIds: string[];
  filters: ImportFilterKey[];
  sort: ImportCandidateSortKey;
}): Promise<BulkAddWorkInput[]> {
  const { records } = await loadImportCandidates();
  const list = await buildImportCandidatesListFromRecords(records, {
    page: 1,
    sort: input.sort,
    filters: input.filters,
    includeAll: true,
  });

  const excluded = new Set(
    input.excludedIds.map((id) => id.trim().toLowerCase()).filter(Boolean),
  );

  return list.candidates
    .filter((candidate) => !excluded.has(candidate.contentId.trim().toLowerCase()))
    .map((candidate) => ({
      contentId: candidate.contentId,
      item: candidate.item,
    }));
}

export async function resolveBulkAddSelection(
  body: unknown,
): Promise<{ works: BulkAddWorkInput[]; appliedLimit: number; selectedCount: number }> {
  if (!body || typeof body !== "object") {
    throw new AddWorkValidationError("リクエスト形式が不正です。");
  }

  const payload = body as BulkAddSelectionRequest & {
    selectedWorks?: Array<{ contentId?: string; item?: DmmItem }>;
  };

  if (payload.mode === "allMatching") {
    const works = await resolveAllMatchingWorks({
      excludedIds: payload.excludedIds ?? [],
      filters: payload.filters ?? [],
      sort: payload.sort ?? "collectedAt-desc",
    });

    if (works.length === 0) {
      throw new AddWorkValidationError("追加する作品が選択されていません。");
    }

    const selectedCount = works.length;
    const appliedLimit = resolveBulkAddLimit(payload.addLimit, selectedCount);
    const limited = works.slice(0, appliedLimit);

    if (limited.length > IMPORT_BULK_ADD_ABSOLUTE_MAX) {
      throw new AddWorkValidationError(
        `1回で追加できるのは${IMPORT_BULK_ADD_ABSOLUTE_MAX}件までです`,
      );
    }

    return { works: limited, appliedLimit, selectedCount };
  }

  const rawWorks = payload.selectedWorks;
  if (!Array.isArray(rawWorks) || rawWorks.length === 0) {
    throw new AddWorkValidationError("追加する作品が選択されていません。");
  }

  const parsedWorks = parseExplicitWorks(rawWorks);
  const appliedLimit = resolveBulkAddLimit(payload.addLimit, parsedWorks.length);
  const works = parsedWorks.slice(0, appliedLimit);

  if (works.length > IMPORT_BULK_ADD_ABSOLUTE_MAX) {
    throw new AddWorkValidationError(
      `1回で追加できるのは${IMPORT_BULK_ADD_ABSOLUTE_MAX}件までです`,
    );
  }

  return { works, appliedLimit, selectedCount: parsedWorks.length };
}
