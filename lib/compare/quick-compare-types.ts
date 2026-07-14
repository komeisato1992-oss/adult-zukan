export type QuickCompareSiteType = "adult" | "doujin";

export type QuickCompareSelectionType =
  | "similar"
  | "ranking"
  | "random"
  | "fallback";

export type QuickCompareResult = {
  workIds: string[];
  href: string;
  selectionType: QuickCompareSelectionType;
};
