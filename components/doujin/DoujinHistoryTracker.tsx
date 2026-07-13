"use client";

import { useEffect } from "react";
import { addToDoujinHistory } from "@/lib/doujin/history";

type DoujinHistoryTrackerProps = {
  workId: string;
  title: string;
  circleId?: string;
  circleName?: string;
};

/** 詳細ページ閲覧を doujin_history に記録 */
export function DoujinHistoryTracker({
  workId,
  title,
  circleId,
  circleName,
}: DoujinHistoryTrackerProps) {
  useEffect(() => {
    addToDoujinHistory({
      id: workId,
      title,
      circleId,
      circleName,
    });
  }, [workId, title, circleId, circleName]);

  return null;
}
