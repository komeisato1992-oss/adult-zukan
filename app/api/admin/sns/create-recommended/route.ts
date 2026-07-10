import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  buildWorkDetailUrl,
  findWorksByProductCode,
  generateRecommendedWorkPost,
  getRecommendedWorkPreviewImageUrl,
} from "@/lib/admin/sns-product-post";
import type { ProductCodeCandidate, SnsScheduledPost } from "@/lib/admin/sns-types";
import { getCatalogItems } from "@/lib/dmm/catalog-entities";
import {
  getDmmItemActressNameList,
  getDmmItemPrice,
} from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";

type CreateRecommendedRequestBody = {
  productCode?: string;
  contentId?: string;
};

function buildManualRecommendedPost(item: DmmItem): SnsScheduledPost {
  return {
    slot: "07:00",
    type: "recommended-work",
    typeLabel: "今日のおすすめ作品",
    body: generateRecommendedWorkPost(item),
    meta: { contentId: item.content_id },
    isManual: true,
    customId: `manual-${item.content_id}-${Date.now()}`,
    previewImageUrl: getRecommendedWorkPreviewImageUrl(item),
    workDetailUrl: buildWorkDetailUrl(item.content_id),
  };
}

function toCandidate(item: DmmItem): ProductCodeCandidate {
  const actressNames = getDmmItemActressNameList(item).join("、");
  return {
    contentId: item.content_id,
    productId: item.product_id,
    title: item.title,
    actressNames: actressNames || undefined,
    price: getDmmItemPrice(item),
    imageUrl: getRecommendedWorkPreviewImageUrl(item),
  };
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as CreateRecommendedRequestBody;
    const productCode = body.productCode?.trim() ?? "";
    const contentId = body.contentId?.trim();

    if (!productCode && !contentId) {
      return NextResponse.json(
        { error: "製品番号を入力してください。" },
        { status: 400 },
      );
    }

    const items = await getCatalogItems();

    if (contentId) {
      const selected = items.find((item) => item.content_id === contentId);
      if (!selected) {
        return NextResponse.json(
          {
            error:
              "該当する作品が見つかりませんでした。製品番号をご確認ください。",
          },
          { status: 404 },
        );
      }

      return NextResponse.json({ post: buildManualRecommendedPost(selected) });
    }

    const matches = findWorksByProductCode(items, productCode);
    if (matches.length === 0) {
      return NextResponse.json(
        {
          error:
            "該当する作品が見つかりませんでした。製品番号をご確認ください。",
        },
        { status: 404 },
      );
    }

    if (matches.length > 1) {
      return NextResponse.json({
        candidates: matches.slice(0, 20).map(toCandidate),
      });
    }

    return NextResponse.json({ post: buildManualRecommendedPost(matches[0]) });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "投稿の生成に失敗しました。カタログの読み込みを確認してください。";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
