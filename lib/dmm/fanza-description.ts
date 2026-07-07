import "server-only";

import { stripHtmlTags } from "@/lib/dmm/description";

const FANZA_GRAPHQL_URL = "https://api.video.dmm.co.jp/graphql";

type PpvDescriptionResponse = {
  data?: {
    ppvProduct?: {
      content?: {
        description?: string | null;
      } | null;
    } | null;
  };
};

/** FANZA 動画 GraphQL API から作品説明を取得 */
export async function fetchFanzaPpvDescription(
  contentId: string,
): Promise<string | undefined> {
  const query = `query PpvDescription($id: ID!) { ppvProduct(id: $id) { content { description } } }`;

  try {
    const response = await fetch(FANZA_GRAPHQL_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { id: contentId },
      }),
      next: { revalidate: 86400 },
    });

    if (!response.ok) return undefined;

    const data = (await response.json()) as PpvDescriptionResponse;
    const description = data.data?.ppvProduct?.content?.description;
    if (!description) return undefined;

    return stripHtmlTags(description) || undefined;
  } catch {
    return undefined;
  }
}
