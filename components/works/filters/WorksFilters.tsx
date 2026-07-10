"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { WorksListControlGroup } from "@/components/works/WorksListControlGroup";
import {
  ActiveFilterChips,
  FilterChip,
  FilterTrigger,
  MultiSelectFilterPanel,
  SearchableOptionGrid,
  SingleSelectFilterPanel,
} from "@/components/works/filters/WorksFilterParts";
import {
  buildWorksFilterDraftFromQuery,
  type WorkDateFilterKey,
  type WorkFilterOption,
  WORK_DATE_FILTER_OPTIONS,
  WORK_PRICE_FILTER_OPTIONS,
  type WorkPriceFilterKey,
  type WorksFilterDraft,
  type WorksListQueryState,
} from "@/lib/works/list-filters";

export type WorksFilterPanelKey = "genre" | "maker" | "price" | "date";

type WorksFiltersProps = {
  genreOptions: WorkFilterOption[];
  makerOptions: WorkFilterOption[];
  appliedQuery: WorksListQueryState;
  onApply: (draft: WorksFilterDraft, resetPage?: boolean) => void;
};

const PRICE_OPTIONS = WORK_PRICE_FILTER_OPTIONS.filter((option) => option.key !== "all");
const DATE_OPTIONS = WORK_DATE_FILTER_OPTIONS.filter((option) => option.key !== "all");

export function WorksFilters({
  genreOptions,
  makerOptions,
  appliedQuery,
  onApply,
}: WorksFiltersProps) {
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [openPanel, setOpenPanel] = useState<WorksFilterPanelKey | null>(null);
  const [draft, setDraft] = useState<WorksFilterDraft>(() =>
    buildWorksFilterDraftFromQuery(appliedQuery),
  );
  const [genreSearch, setGenreSearch] = useState("");
  const [makerSearch, setMakerSearch] = useState("");

  useEffect(() => {
    setDraft(buildWorksFilterDraftFromQuery(appliedQuery));
  }, [appliedQuery]);

  const togglePanel = useCallback((panel: WorksFilterPanelKey) => {
    setOpenPanel((current) => (current === panel ? null : panel));
    setGenreSearch("");
    setMakerSearch("");
  }, []);

  const closePanel = useCallback(() => {
    setOpenPanel(null);
    setGenreSearch("");
    setMakerSearch("");
  }, []);

  useEffect(() => {
    if (!openPanel) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && containerRef.current && !containerRef.current.contains(target)) {
        closePanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [closePanel, openPanel]);

  const applyDraft = useCallback(() => {
    onApply(draft, true);
    closePanel();
  }, [closePanel, draft, onApply]);

  const clearDraftPanel = useCallback(() => {
    if (openPanel === "genre") {
      setDraft((current) => ({ ...current, genres: [] }));
      setGenreSearch("");
      return;
    }
    if (openPanel === "maker") {
      setDraft((current) => ({ ...current, makers: [] }));
      setMakerSearch("");
      return;
    }
    if (openPanel === "price") {
      setDraft((current) => ({ ...current, price: "all" }));
      return;
    }
    if (openPanel === "date") {
      setDraft((current) => ({ ...current, date: "all" }));
    }
  }, [openPanel]);

  const appliedDraft = useMemo(
    () => buildWorksFilterDraftFromQuery(appliedQuery),
    [appliedQuery],
  );

  const activeChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];

    for (const genre of appliedDraft.genres) {
      chips.push({
        id: `genre-${genre}`,
        label: genre,
        onRemove: () => {
          onApply(
            {
              ...appliedDraft,
              genres: appliedDraft.genres.filter((value) => value !== genre),
            },
            true,
          );
        },
      });
    }

    for (const maker of appliedDraft.makers) {
      chips.push({
        id: `maker-${maker}`,
        label: maker,
        onRemove: () => {
          onApply(
            {
              ...appliedDraft,
              makers: appliedDraft.makers.filter((value) => value !== maker),
            },
            true,
          );
        },
      });
    }

    if (appliedDraft.price !== "all") {
      const priceLabel =
        WORK_PRICE_FILTER_OPTIONS.find((option) => option.key === appliedDraft.price)
          ?.label ?? appliedDraft.price;
      chips.push({
        id: `price-${appliedDraft.price}`,
        label: priceLabel,
        onRemove: () => {
          onApply({ ...appliedDraft, price: "all" }, true);
        },
      });
    }

    if (appliedDraft.date !== "all") {
      const dateLabel =
        WORK_DATE_FILTER_OPTIONS.find((option) => option.key === appliedDraft.date)
          ?.label ?? appliedDraft.date;
      chips.push({
        id: `date-${appliedDraft.date}`,
        label: dateLabel,
        onRemove: () => {
          onApply({ ...appliedDraft, date: "all" }, true);
        },
      });
    }

    return chips;
  }, [appliedDraft, onApply]);

  const clearAllApplied = useCallback(() => {
    onApply(
      {
        genres: [],
        makers: [],
        price: "all",
        date: "all",
      },
      true,
    );
  }, [onApply]);

  const toggleGenre = useCallback((value: string) => {
    setDraft((current) => ({
      ...current,
      genres: current.genres.includes(value)
        ? current.genres.filter((genre) => genre !== value)
        : [...current.genres, value],
    }));
  }, []);

  const toggleMaker = useCallback((value: string) => {
    setDraft((current) => ({
      ...current,
      makers: current.makers.includes(value)
        ? current.makers.filter((maker) => maker !== value)
        : [...current.makers, value],
    }));
  }, []);

  return (
    <div ref={containerRef} className="space-y-3">
      <WorksListControlGroup label="絞り込み">
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-1 sm:flex-wrap sm:gap-3">
          <FilterTrigger
            label="ジャンル"
            count={appliedDraft.genres.length}
            isOpen={openPanel === "genre"}
            onClick={() => togglePanel("genre")}
          />
          <FilterTrigger
            label="メーカー"
            count={appliedDraft.makers.length}
            isOpen={openPanel === "maker"}
            onClick={() => togglePanel("maker")}
          />
          <FilterTrigger
            label="価格帯"
            count={appliedDraft.price !== "all" ? 1 : 0}
            isOpen={openPanel === "price"}
            onClick={() => togglePanel("price")}
          />
          <FilterTrigger
            label="発売日"
            count={appliedDraft.date !== "all" ? 1 : 0}
            isOpen={openPanel === "date"}
            onClick={() => togglePanel("date")}
          />
        </div>
      </WorksListControlGroup>

      {openPanel ? (
        <div
          id={`${panelId}-${openPanel}`}
          role="region"
          aria-label={`${openPanel}フィルター`}
        >
          {openPanel === "genre" ? (
            <MultiSelectFilterPanel onClear={clearDraftPanel} onApply={applyDraft}>
              <SearchableOptionGrid
                options={genreOptions}
                selectedValues={draft.genres}
                onToggle={toggleGenre}
                searchPlaceholder="ジャンル名を検索"
                searchQuery={genreSearch}
                onSearchQueryChange={setGenreSearch}
              />
            </MultiSelectFilterPanel>
          ) : null}

          {openPanel === "maker" ? (
            <MultiSelectFilterPanel onClear={clearDraftPanel} onApply={applyDraft}>
              <SearchableOptionGrid
                options={makerOptions}
                selectedValues={draft.makers}
                onToggle={toggleMaker}
                searchPlaceholder="メーカー名を検索"
                searchQuery={makerSearch}
                onSearchQueryChange={setMakerSearch}
              />
            </MultiSelectFilterPanel>
          ) : null}

          {openPanel === "price" ? (
            <SingleSelectFilterPanel onClear={clearDraftPanel} onApply={applyDraft}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PRICE_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.key}
                    label={option.label}
                    selected={draft.price === option.key}
                    showCheck={false}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        price:
                          current.price === option.key
                            ? "all"
                            : (option.key as WorkPriceFilterKey),
                      }))
                    }
                  />
                ))}
              </div>
            </SingleSelectFilterPanel>
          ) : null}

          {openPanel === "date" ? (
            <SingleSelectFilterPanel onClear={clearDraftPanel} onApply={applyDraft}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DATE_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.key}
                    label={option.label}
                    selected={draft.date === option.key}
                    showCheck={false}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        date:
                          current.date === option.key
                            ? "all"
                            : (option.key as WorkDateFilterKey),
                      }))
                    }
                  />
                ))}
              </div>
            </SingleSelectFilterPanel>
          ) : null}
        </div>
      ) : null}

      <ActiveFilterChips chips={activeChips} onClearAll={clearAllApplied} />
    </div>
  );
}
