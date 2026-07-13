"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type DoujinSearchBarProps = {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  compact?: boolean;
};

export function DoujinSearchBar({
  defaultValue = "",
  placeholder = "作品名・サークル・作者で検索",
  className = "",
  compact = false,
}: DoujinSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/doujin/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/doujin/search");
    }
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={`flex items-center ${compact ? "gap-1" : "gap-2"} ${className}`}
    >
      <label htmlFor="doujin-site-search" className="sr-only">
        同人作品検索
      </label>
      <input
        id="doujin-site-search"
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full rounded border border-border bg-white text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${
          compact ? "h-9 px-3 text-sm" : "h-10 px-4 text-sm"
        }`}
      />
      <button
        type="submit"
        className={`inline-flex shrink-0 items-center justify-center rounded bg-accent font-medium text-white transition-colors hover:bg-accent-hover ${
          compact ? "h-9 px-3 text-sm" : "h-10 px-5 text-sm"
        }`}
      >
        検索
      </button>
    </form>
  );
}
