import type { WorkListCardItem } from "@/lib/works/work-list-card-item.types";

type WorkListSalePriceProps = {
  item: WorkListCardItem;
};

export function WorkListSalePrice({ item }: WorkListSalePriceProps) {
  if (!item.saleInfo) {
    return null;
  }

  const { regularPrice, currentPrice, discountRate } = item.saleInfo;

  return (
    <div className="mt-2 min-h-[3.25rem]">
      <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
        <span className="text-sm text-muted line-through">
          ¥{regularPrice.toLocaleString("ja-JP")}
        </span>
        <span className="text-lg font-bold leading-none text-accent">
          ¥{currentPrice.toLocaleString("ja-JP")}
        </span>
      </div>
      <span className="mt-1 inline-flex rounded-md bg-accent-light px-2 py-1 text-xs font-bold text-accent">
        {discountRate}% OFF!
      </span>
    </div>
  );
}
