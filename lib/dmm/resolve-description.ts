import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getDmmItemDescription } from "@/lib/dmm/description";
import { fetchFanzaPpvDescription } from "@/lib/dmm/fanza-description";
import type { DmmItem } from "@/lib/dmm/types";

/** スナップショット → APIフィールド → FANZA GraphQL の順で説明文を解決 */
export const resolveDmmItemDescription = cache(
  async (item: DmmItem): Promise<string | undefined> => {
    const stored = getDmmItemDescription(item);
    if (stored) return stored;

    const cachedFetch = unstable_cache(
      async () => fetchFanzaPpvDescription(item.content_id),
      ["fanza-work-description", item.content_id],
      { revalidate: 86400 },
    );

    return cachedFetch();
  },
);
