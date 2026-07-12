import "server-only";

import { cache } from "react";
import { getCatalogWorks } from "@/lib/catalog";
import { encodeActressSlug } from "@/lib/actresses/slug";
import {
  ACTRESS_IMAGE_SELECTION_VERSION,
  listActressImageCandidates,
  selectActressRepresentativeImage,
  selectActressRepresentativeImageAutomaticOnly,
  clothingConfidenceLabel,
  type ScoredCandidate,
} from "@/lib/dmm/actress-representative-image";
import {
  clearActressImageOverrideCache,
  ensureActressImageOverridesLoaded,
  getActressImageOverride,
  isManualActressImageOverride,
  removeActressImageOverride,
  upsertActressImageOverride,
  upsertAutomaticActressImageOverride,
} from "@/lib/dmm/actress-image-overrides";
import {
  getCatalogActresses,
  getCatalogWorksByActressSlug,
} from "@/lib/dmm/catalog-entities";
import {
  getClothedReselectJob,
  startClothedReselectJob,
  tickClothedReselectJob,
  type ClothedReselectJob,
} from "@/lib/admin/actress-image-reselect-job";

export async function getActressImageReview(actressName: string) {
  await ensureActressImageOverridesLoaded();
  const works = await getCatalogWorks();
  const slug = encodeActressSlug(actressName);
  const actressWorks = getCatalogWorksByActressSlug(works, slug);
  const selection = selectActressRepresentativeImage({
    actress: { name: actressName, slug },
    works: actressWorks,
  });
  const override = getActressImageOverride(slug, actressName);
  const candidates = listActressImageCandidates({
    actressName,
    works: actressWorks,
    limit: 24,
  }).map((candidate) => enrichCandidateForAdmin(candidate));

  return {
    actressName,
    slug,
    workCount: actressWorks.length,
    selectionVersion: ACTRESS_IMAGE_SELECTION_VERSION,
    override,
    isManualOverride: isManualActressImageOverride(override),
    selection,
    candidates,
  };
}

function enrichCandidateForAdmin(
  candidate: ScoredCandidate & { reason: string },
) {
  return {
    ...candidate,
    clothingConfidenceLabel: clothingConfidenceLabel(
      candidate.clothingConfidence,
    ),
    reasonLines: candidate.scoreBreakdown
      .filter((row) => row.points !== 0)
      .map((row) => `${row.label} ${row.points > 0 ? "+" : ""}${row.points}`),
  };
}

export async function applyActressImageManualSelection(input: {
  actressName: string;
  mode: "pick" | "default" | "clear";
  imageUrl?: string;
  workId?: string | null;
  isSoloWork?: boolean;
  faceDetected?: boolean;
  score?: number;
}) {
  await ensureActressImageOverridesLoaded();
  const slug = encodeActressSlug(input.actressName);

  if (input.mode === "clear") {
    await removeActressImageOverride(slug);
    clearActressImageOverrideCache();
    await ensureActressImageOverridesLoaded();
    return getActressImageReview(input.actressName);
  }

  if (input.mode === "default") {
    await upsertActressImageOverride({
      actress_id: slug,
      useDefault: true,
      selection_type: "manual",
      note: "manual-default",
      selected_by: "admin",
    });
    clearActressImageOverrideCache();
    await ensureActressImageOverridesLoaded();
    return getActressImageReview(input.actressName);
  }

  if (!input.imageUrl) {
    throw new Error("imageUrl が必要です。");
  }

  await upsertActressImageOverride({
    actress_id: slug,
    image_url: input.imageUrl,
    work_id: input.workId ?? null,
    isSoloWork: input.isSoloWork,
    faceDetected: input.faceDetected,
    score: input.score,
    selection_type: "manual",
    note: "manual-pick",
    selected_by: "admin",
  });
  clearActressImageOverrideCache();
  await ensureActressImageOverridesLoaded();
  return getActressImageReview(input.actressName);
}

/**
 * 再選定プレビュー（手動設定は上書きしない・保存もしない）
 */
export async function previewActressImageReselect(actressName: string) {
  return getActressImageReview(actressName);
}

export async function startClothedPriorityReselect(): Promise<ClothedReselectJob> {
  await ensureActressImageOverridesLoaded();
  const works = await getCatalogWorks();
  const actresses = getCatalogActresses(works);
  const targets = actresses
    .map((actress) => ({
      name: actress.name,
      slug: encodeActressSlug(actress.name),
    }))
    .filter(({ name, slug }) => {
      const override = getActressImageOverride(slug, name);
      return !isManualActressImageOverride(override);
    });

  return startClothedReselectJob(targets);
}

export async function processClothedPriorityReselectChunk(
  limit = 8,
): Promise<ClothedReselectJob> {
  await ensureActressImageOverridesLoaded();
  const works = await getCatalogWorks();

  return tickClothedReselectJob(limit, async (target) => {
    const actressWorks = getCatalogWorksByActressSlug(works, target.slug);
    const selection = selectActressRepresentativeImageAutomaticOnly({
      actress: { name: target.name, slug: target.slug },
      works: actressWorks,
    });

    if (!selection?.imageUrl) {
      return "unchanged";
    }

    const existing = getActressImageOverride(target.slug, target.name);
    if (isManualActressImageOverride(existing)) {
      return "skipped_manual";
    }

    const same =
      existing?.selection_type === "automatic" &&
      (existing.image_url ?? existing.imageUrl) === selection.imageUrl;

    if (same) return "unchanged";

    const updated = await upsertAutomaticActressImageOverride({
      actress_id: target.slug,
      image_url: selection.imageUrl,
      work_id: selection.workId,
      score: selection.score,
      faceDetected: selection.faceDetected,
      isSoloWork: selection.isSoloWork,
    });

    return updated ? "updated" : "skipped_manual";
  });
}

export async function getClothedPriorityReselectStatus(): Promise<ClothedReselectJob | null> {
  return getClothedReselectJob();
}
