import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getCatalogItems } from "@/lib/dmm/catalog-entities";
import { getRankedGenres } from "@/lib/dmm/home-sections";
import { buildSnsPostUrl } from "@/lib/admin/sns-posts";
import {
  appendSnsPostHistory,
  toSnsPostHistoryStoreErrorMessage,
} from "@/lib/admin/sns-post-history-store";
import type { SnsPostMeta, SnsPostType } from "@/lib/admin/sns-types";

type MarkPostedRequestBody = {
  postType?: SnsPostType;
  meta?: SnsPostMeta;
  postText?: string;
  postUrl?: string;
};

const VALID_TYPES: SnsPostType[] = [
  "recommended-work",
  "compare",
  "actress",
  "genre",
  "ranking",
];

async function resolveGenreName(genreSlug?: string): Promise<string | undefined> {
  if (!genreSlug?.trim()) return undefined;

  const items = await getCatalogItems();
  const genre = getRankedGenres(items, 200).find(
    (entry) => entry.slug === genreSlug,
  );
  return genre?.name;
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as MarkPostedRequestBody;

    if (!body.postType || !VALID_TYPES.includes(body.postType)) {
      return NextResponse.json(
        { error: "投稿タイプが不正です。" },
        { status: 400 },
      );
    }

    if (!body.postText?.trim()) {
      return NextResponse.json(
        { error: "投稿文が空です。" },
        { status: 400 },
      );
    }

    const meta = body.meta ?? {};
    const genreName = await resolveGenreName(meta.genreSlug);
    const postUrl =
      body.postUrl?.trim() ||
      buildSnsPostUrl({
        type: body.postType,
        compareUrl: undefined,
        meta,
      });

    const entry = await appendSnsPostHistory({
      postType: body.postType,
      contentId: meta.contentId,
      compareIds: meta.compareContentIds,
      actressName: meta.actressName,
      genreName,
      postText: body.postText.trim(),
      postUrl,
    });

    return NextResponse.json({ entry });
  } catch (error) {
    const { message, status } = toSnsPostHistoryStoreErrorMessage(error);
    return NextResponse.json({ error: message }, { status });
  }
}
