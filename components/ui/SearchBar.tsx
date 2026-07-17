"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type SearchBarProps = {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  compact?: boolean;
  inputId?: string;
  autoFocus?: boolean;
};

export function SearchBar({
  defaultValue = "",
  placeholder = "作品名・品番・女優名で検索",
  className = "",
  compact = false,
  inputId = "site-search",
  autoFocus = false,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/search");
    }
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={`box-border flex w-full max-w-full items-center ${
        compact ? "gap-1 max-[768px]:gap-2" : "gap-2"
      } ${className}`}
    >
      <label htmlFor={inputId} className="sr-only">
        作品検索
      </label>
      <input
        id={inputId}
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        className={`box-border min-w-0 flex-1 rounded border border-border bg-white text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${
          compact
            ? "h-9 px-3 text-sm max-[768px]:h-10 max-[768px]:text-[15px]"
            : "h-10 px-4 text-sm"
        }`}
      />
      <button
        type="submit"
        className={`box-border inline-flex shrink-0 items-center justify-center rounded bg-accent font-medium text-white transition-colors hover:bg-accent-hover max-[768px]:min-w-[72px] ${
          compact
            ? "h-9 px-3 text-sm max-[768px]:h-10 max-[768px]:px-3.5"
            : "h-10 px-5 text-sm max-[768px]:px-4"
        }`}
      >
        検索
      </button>
    </form>
  );
}
