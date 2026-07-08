import type { SnsPostType } from "@/lib/admin/sns-types";

export type SnsPostHistoryEntry = {
  id: string;
  postedAt: string;
  postType: SnsPostType;
  contentId?: string;
  compareIds?: [string, string];
  actressName?: string;
  genreName?: string;
  postText: string;
  postUrl?: string;
};
