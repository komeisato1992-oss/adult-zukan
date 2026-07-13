import "server-only";

import {
  parseDoujinAuthorLimitParam,
  parseDoujinAuthorSortParam,
  type DoujinAuthorListItem,
  type DoujinAuthorListPageData,
  type DoujinAuthorSortKey,
} from "@/lib/doujin/author-list";
import { getRepresentativeWorkForAuthor } from "@/lib/doujin/author-representative";
import {
  getDoujinAuthorList,
  sortDoujinWorks,
  type DoujinWorkSortKey,
} from "@/lib/doujin/catalog";
import { paginateItems, parsePageParam } from "@/lib/pagination";
import type { DoujinWork } from "@/lib/doujin/types";

function sortAuthorListItems(
  items: DoujinAuthorListItem[],
  sort: DoujinAuthorSortKey,
): DoujinAuthorListItem[] {
  const list = [...items];
  switch (sort) {
    case "new":
      return list.sort((a, b) =>
        b.latestReleaseDate.localeCompare(a.latestReleaseDate),
      );
    case "rating":
      return list.sort((a, b) => b.maxRating - a.maxRating);
    case "name":
      return list.sort((a, b) => a.name.localeCompare(b.name, "ja"));
    case "workCount":
    default:
      return list.sort((a, b) => {
        if (b.workCount !== a.workCount) return b.workCount - a.workCount;
        return a.name.localeCompare(b.name, "ja");
      });
  }
}

/** 作者一覧用の集約データを一括取得（N+1なし） */
export function getDoujinAuthorListItems(): DoujinAuthorListItem[] {
  const authors = getDoujinAuthorList();
  return authors.map((author) => {
    const works = author.works;
    let latestReleaseDate = "";
    let maxRating = 0;
    for (const work of works) {
      const release = work.releaseDate ?? "";
      if (release > latestReleaseDate) latestReleaseDate = release;
      if ((work.rating ?? 0) > maxRating) maxRating = work.rating ?? 0;
    }
    return {
      id: author.id,
      name: author.name,
      workCount: author.workCount,
      latestReleaseDate,
      maxRating,
      representativeWork: getRepresentativeWorkForAuthor(works),
    };
  });
}

export function getDoujinAuthorListPageData(options: {
  sort?: string | null;
  perPage?: string | null;
  page?: string | null;
}): DoujinAuthorListPageData {
  const sort = parseDoujinAuthorSortParam(options.sort);
  const perPage = parseDoujinAuthorLimitParam(options.perPage);
  const page = parsePageParam(options.page ?? undefined);
  const sorted = sortAuthorListItems(getDoujinAuthorListItems(), sort);
  const paginated = paginateItems(sorted, page, perPage);

  return {
    pageItems: paginated.items,
    totalItems: paginated.totalItems,
    totalPages: paginated.totalPages,
    currentPage: paginated.currentPage,
    sort,
    perPage,
  };
}

export function sortAuthorWorks(
  works: DoujinWork[],
  sort: DoujinWorkSortKey,
): DoujinWork[] {
  return sortDoujinWorks(works, sort);
}
