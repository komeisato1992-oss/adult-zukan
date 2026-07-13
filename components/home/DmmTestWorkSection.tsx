"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { DmmItem, DmmTestApiResponse } from "@/lib/dmm/types";
import { getDmmItemImageUrl, getDmmItemPrice } from "@/lib/dmm/display";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import { FanzaLinkButton } from "@/components/works/FanzaLinkButton";

type FetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; item: DmmItem };

function DmmWorkCard({ item }: { item: DmmItem }) {
  const imageUrl = getDmmItemImageUrl(item);
  const detailHref = `/works/${item.content_id}`;
  const fanzaUrl = getDmmFanzaUrl(item);

  return (
    <article className="overflow-hidden rounded-lg border border-border/80 bg-white shadow-sm">
      <div className="grid gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
        <Link
          href={detailHref}
          className="relative mx-auto flex aspect-[2/3] w-full max-w-[280px] items-center justify-center bg-white md:mx-0"
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={item.title}
              fill
              className="object-contain object-center p-2"
              sizes="280px"
              unoptimized
            />
          ) : (
            <span className="text-sm text-muted">画像なし</span>
          )}
        </Link>

        <div className="flex flex-col justify-between gap-6 p-4 md:p-6">
          <div className="space-y-4">
            <div>
              <Link
                href={detailHref}
                className="text-xl font-bold leading-snug text-foreground transition-colors hover:text-accent"
              >
                {item.title}
              </Link>
              <p className="mt-2 text-sm text-muted">{item.content_id}</p>
              {getDmmItemPrice(item) && (
                <p className="mt-2 text-lg font-bold text-price">
                  {getDmmItemPrice(item)}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={detailHref}
              className="inline-flex items-center justify-center rounded-md border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              作品詳細を見る
            </Link>
            <FanzaLinkButton href={fanzaUrl} className="sm:w-auto" />
          </div>
        </div>
      </div>
    </article>
  );
}

export function DmmTestWorkSection() {
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function loadItem() {
      try {
        const response = await fetch("/api/dmm/test");

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => null)) as
            | { message?: string }
            | null;
          throw new Error(errorBody?.message ?? "作品の取得に失敗しました");
        }

        const data = (await response.json()) as DmmTestApiResponse;
        const item = data.result.items[0];

        if (!item) {
          throw new Error("作品が見つかりませんでした");
        }

        if (!cancelled) {
          setState({ status: "success", item });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error ? error.message : "作品の取得に失敗しました",
          });
        }
      }
    }

    void loadItem();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <section className="rounded-lg border border-border/80 bg-white p-8 text-center text-sm text-muted">
        作品を読み込んでいます...
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="rounded-lg border border-border/80 bg-white p-8 text-center text-sm text-accent">
        {state.message}
      </section>
    );
  }

  return (
    <section aria-labelledby="featured-work-title">
      <h2 id="featured-work-title" className="sr-only">
        おすすめ作品
      </h2>
      <DmmWorkCard item={state.item} />
    </section>
  );
}
