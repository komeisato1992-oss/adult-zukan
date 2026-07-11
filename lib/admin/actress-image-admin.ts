import "server-only";

import { getCatalogWorks } from "@/lib/catalog";
import { encodeActressSlug } from "@/lib/actresses/slug";
import {
  ACTRESS_IMAGE_SELECTION_VERSION,
  listActressImageCandidates,
  selectActressRepresentativeImage,
} from "@/lib/dmm/actress-representative-image";
import {
  getActressImageOverride,
  removeActressImageOverride,
  upsertActressImageOverride,
} from "@/lib/dmm/actress-image-overrides";
import { getCatalogWorksByActressSlug } from "@/lib/dmm/catalog-entities";

export async function getActressImageReview(actressName: string) {
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
    limit: 12,
  });

  return {
    actressName,
    slug,
    workCount: actressWorks.length,
    selectionVersion: ACTRESS_IMAGE_SELECTION_VERSION,
    override,
    selection,
    candidates,
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
  const slug = encodeActressSlug(input.actressName);

  if (input.mode === "clear") {
    removeActressImageOverride(slug);
    removeActressImageOverride(input.actressName);
    return getActressImageReview(input.actressName);
  }

  if (input.mode === "default") {
    upsertActressImageOverride({
      key: slug,
      useDefault: true,
      note: "manual-default",
    });
    return getActressImageReview(input.actressName);
  }

  if (!input.imageUrl) {
    throw new Error("imageUrl が必要です。");
  }

  upsertActressImageOverride({
    key: slug,
    imageUrl: input.imageUrl,
    workId: input.workId ?? null,
    isSoloWork: input.isSoloWork,
    faceDetected: input.faceDetected,
    score: input.score,
    note: "manual-pick",
  });

  return getActressImageReview(input.actressName);
}
