"use client";

import { useMemo, useState } from "react";
import { ImportGeneratedPost } from "@/components/admin/ImportGeneratedPost";
import { SnsCompareImagePreview } from "@/components/admin/SnsCompareImagePreview";
import type { SnsCompareWorkMini } from "@/lib/admin/sns-types";
import {
  buildImportActressPost,
  buildImportComparePost,
  buildImportRecommendedWorkPost,
  IMPORT_SNS_POST_TYPE_LABELS,
  pickImportActressName,
  pickImportComparePair,
  type ImportSnsPostType,
} from "@/lib/admin/import-sns-posts";
import { getDmmItemActressNameList } from "@/lib/dmm/display";
import type { DmmItem } from "@/lib/dmm/types";

type ImportBulkSnsPanelProps = {
  items: DmmItem[];
};

export function ImportBulkSnsPanel({ items }: ImportBulkSnsPanelProps) {
  const [snsType, setSnsType] = useState<ImportSnsPostType | "">("");
  const [selectedActress, setSelectedActress] = useState("");
  const [generatedPost, setGeneratedPost] = useState<{
    typeLabel: string;
    body: string;
    compareWorks?: [SnsCompareWorkMini, SnsCompareWorkMini];
    compareUrl?: string;
  } | null>(null);

  const actressOptions = useMemo(() => {
    const names = new Set<string>();
    for (const item of items) {
      for (const name of getDmmItemActressNameList(item)) {
        names.add(name);
      }
    }
    return [...names];
  }, [items]);

  function handleGenerate() {
    if (!snsType) return;

    if (snsType === "recommended-work") {
      const work = items[Math.floor(Math.random() * items.length)];
      if (!work) return;
      setGeneratedPost({
        typeLabel: IMPORT_SNS_POST_TYPE_LABELS["recommended-work"],
        body: buildImportRecommendedWorkPost(work),
      });
      return;
    }

    if (snsType === "compare") {
      const pair = pickImportComparePair(items);
      if (!pair) return;
      const result = buildImportComparePost(pair[0], pair[1]);
      setGeneratedPost({
        typeLabel: IMPORT_SNS_POST_TYPE_LABELS.compare,
        body: result.body,
        compareWorks: result.compareWorks,
        compareUrl: result.compareUrl,
      });
      return;
    }

    const actress = selectedActress || pickImportActressName(items);
    if (!actress) return;
    setGeneratedPost({
      typeLabel: IMPORT_SNS_POST_TYPE_LABELS.actress,
      body: buildImportActressPost(actress, items),
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-accent/30 bg-[#FFF2F2] p-4 shadow-sm">
      <p className="text-sm font-bold text-foreground">
        追加作品からSNS投稿を作成（{items.length}件）
      </p>
      <p className="mt-1 text-xs text-muted">
        直近に追加した作品から投稿文を生成できます。
      </p>

      {snsType === "" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSnsType("recommended-work")}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
          >
            {IMPORT_SNS_POST_TYPE_LABELS["recommended-work"]}
          </button>
          <button
            type="button"
            onClick={() => setSnsType("compare")}
            disabled={items.length < 2}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {IMPORT_SNS_POST_TYPE_LABELS.compare}
          </button>
          <button
            type="button"
            onClick={() => setSnsType("actress")}
            disabled={actressOptions.length === 0}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {IMPORT_SNS_POST_TYPE_LABELS.actress}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold">{IMPORT_SNS_POST_TYPE_LABELS[snsType]}</p>
            <button
              type="button"
              onClick={() => {
                setSnsType("");
                setGeneratedPost(null);
              }}
              className="text-xs text-muted hover:text-accent"
            >
              タイプを変更
            </button>
          </div>

          {snsType === "actress" && actressOptions.length > 1 ? (
            <select
              value={selectedActress}
              onChange={(event) => {
                setSelectedActress(event.target.value);
                setGeneratedPost(null);
              }}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              {actressOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : null}

          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
          >
            投稿文を生成
          </button>

          {generatedPost ? (
            <>
              {generatedPost.compareWorks && generatedPost.compareUrl ? (
                <SnsCompareImagePreview
                  works={generatedPost.compareWorks}
                  compareUrl={generatedPost.compareUrl}
                />
              ) : null}
              <ImportGeneratedPost
                typeLabel={generatedPost.typeLabel}
                body={generatedPost.body}
              />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
