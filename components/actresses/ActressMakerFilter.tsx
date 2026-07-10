"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { WorksListControlGroup } from "@/components/works/WorksListControlGroup";
import type { ActressPageMaker } from "@/lib/dmm/actress-page";
import { parseWorkSortParam } from "@/lib/works/sort";

type ActressMakerFilterProps = {
  makers: ActressPageMaker[];
  basePath: string;
  selectedMaker?: string;
};

function buildActressFilterHref(
  basePath: string,
  maker: string,
  sort: string | undefined,
): string {
  const params = new URLSearchParams();

  if (maker !== "all") {
    params.set("maker", maker);
  }

  const parsedSort = parseWorkSortParam(sort);
  if (parsedSort !== "popular") {
    params.set("sort", parsedSort);
  }

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function ActressMakerFilter({
  makers,
  basePath,
  selectedMaker,
}: ActressMakerFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentMaker = selectedMaker ?? "all";

  return (
    <WorksListControlGroup label="絞り込み" className="mb-4">
      <select
        id="actress-maker-filter"
        value={currentMaker}
        onChange={(event) => {
          const href = buildActressFilterHref(
            basePath,
            event.target.value,
            searchParams.get("sort") ?? undefined,
          );
          router.push(href);
        }}
        className="h-10 min-w-[160px] rounded border border-border bg-white px-3 text-sm text-foreground"
      >
        <option value="all">メーカー ▼</option>
        {makers.map((maker) => (
          <option key={maker.name} value={maker.name}>
            {maker.name}
          </option>
        ))}
      </select>
    </WorksListControlGroup>
  );
}
