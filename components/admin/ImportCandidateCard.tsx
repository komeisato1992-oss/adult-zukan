"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ImportGeneratedPost } from "@/components/admin/ImportGeneratedPost";
import { ImportImageLightbox } from "@/components/admin/ImportImageLightbox";
import type { ImportCandidateSource } from "@/lib/admin/import-candidates";
import {
  buildImportActressPost,
  buildImportRecommendedWorkPost,
  formatImportCatalogJson,
  IMPORT_SNS_POST_TYPE_LABELS,
  type ImportSnsPostType,
} from "@/lib/admin/import-sns-posts";
import { getDmmItemDescription } from "@/lib/dmm/description";
import {
  getDmmItemActressNameList,
  getDmmItemGenreNames,
  getDmmItemImageUrl,
  getDmmItemLabelName,
  getDmmItemMakerName,
  getDmmItemPrice,
  getDmmItemSeriesName,
} from "@/lib/dmm/display";
import { getDmmFanzaUrl } from "@/lib/dmm/fanza-url";
import { getDmmReleaseDateInfo } from "@/lib/dmm/release-date";
import type { DmmItem } from "@/lib/dmm/types";

type ImportCandidateCardProps = {
  item: DmmItem;
  source: ImportCandidateSource;
  sourceLabel: string;
  onExclude: (contentId: string) => void;
};

const ACTION_BUTTON_CLASS =
  "inline-flex h-11 min-h-[44px] flex-1 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors";

function SummaryField({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`mt-0.5 text-sm leading-snug ${
          emphasize ? "font-semibold text-accent" : "text-foreground"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export function ImportCandidateCard({
  item,
  source,
  sourceLabel,
  onExclude,
}: ImportCandidateCardProps) {
  const [showJson, setShowJson] = useState(false);
  const [showSnsPanel, setShowSnsPanel] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [snsType, setSnsType] = useState<ImportSnsPostType | "">("");
  const [selectedActress, setSelectedActress] = useState("");
  const [generatedPost, setGeneratedPost] = useState<{
    typeLabel: string;
    body: string;
  } | null>(null);

  const imageUrl = getDmmItemImageUrl(item);
  const actressNames = getDmmItemActressNameList(item);
  const release = getDmmReleaseDateInfo(item);
  const duration = item.volume?.trim() ? `${item.volume}分` : "-";
  const description = getDmmItemDescription(item);
  const fanzaUrl = getDmmFanzaUrl(item);
  const importJson = useMemo(() => formatImportCatalogJson(item), [item]);

  const sourceBadgeClass =
    source === "new"
      ? "bg-accent-light text-accent"
      : "bg-surface text-foreground";

  async function handleCopyJson() {
    try {
      await navigator.clipboard.writeText(importJson);
      setJsonCopied(true);
      window.setTimeout(() => setJsonCopied(false), 2000);
    } catch {
      setJsonCopied(false);
    }
  }

  function handleGenerateSns() {
    if (!snsType) return;

    if (snsType === "recommended-work") {
      setGeneratedPost({
        typeLabel: IMPORT_SNS_POST_TYPE_LABELS["recommended-work"],
        body: buildImportRecommendedWorkPost(item),
      });
      return;
    }

    const actress = selectedActress || actressNames[0];
    if (!actress) return;

    setGeneratedPost({
      typeLabel: IMPORT_SNS_POST_TYPE_LABELS.actress,
      body: buildImportActressPost(actress),
    });
  }

  function handleSnsTypeChange(nextType: ImportSnsPostType | "") {
    setSnsType(nextType);
    setGeneratedPost(null);

    if (nextType === "actress" && actressNames.length >= 1) {
      setSelectedActress(actressNames[0] ?? "");
    } else if (nextType !== "actress") {
      setSelectedActress("");
    }
  }

  function openSnsPanel() {
    setShowJson(false);
    setShowSnsPanel(true);
    setSnsType("");
    setGeneratedPost(null);
    setSelectedActress("");
  }

  function openJsonPanel() {
    setShowJson(true);
    setShowSnsPanel(false);
  }

  const actressText =
    actressNames.length > 0 ? actressNames.join("、") : "-";
  const makerText = getDmmItemMakerName(item) ?? "-";
  const priceText = getDmmItemPrice(item) ?? "-";
  const releaseText = release?.value ?? "-";

  return (
    <article className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${sourceBadgeClass}`}
        >
          {sourceLabel}
        </span>
        <p className="text-xs text-muted">{item.content_id}</p>
      </div>

      <div className="mt-3 flex gap-3 lg:mt-4 lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-5">
        <div className="shrink-0">
          {imageUrl ? (
            <button
              type="button"
              onClick={() => setShowLightbox(true)}
              className="block overflow-hidden rounded-lg border border-border"
              aria-label={`${item.title} の画像を拡大表示`}
            >
              <Image
                src={imageUrl}
                alt={item.title}
                width={120}
                height={170}
                className="h-auto w-[110px] object-cover sm:w-[120px] lg:w-full lg:max-w-[180px]"
                unoptimized
              />
            </button>
          ) : (
            <div className="h-[147px] w-[110px] rounded-lg bg-surface sm:w-[120px] lg:aspect-[3/4] lg:h-auto lg:w-full" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-3 text-sm font-bold leading-snug text-foreground sm:text-base">
            {item.title}
          </h3>

          <dl className="mt-2 space-y-2 lg:hidden">
            <SummaryField label="女優" value={actressText} />
            <SummaryField label="メーカー" value={makerText} />
            <SummaryField label="発売日" value={releaseText} />
            <SummaryField label="価格" value={priceText} emphasize />
          </dl>

          <dl className="mt-4 hidden gap-2 text-sm lg:grid lg:grid-cols-2">
            <SummaryField label="女優" value={actressText} />
            <SummaryField label="メーカー" value={makerText} />
            <SummaryField label="レーベル" value={getDmmItemLabelName(item) ?? "-"} />
            <SummaryField label="シリーズ" value={getDmmItemSeriesName(item) ?? "-"} />
            <SummaryField label="ジャンル" value={getDmmItemGenreNames(item) ?? "-"} />
            <SummaryField label="価格" value={priceText} emphasize />
            <SummaryField label="発売日" value={releaseText} />
            <SummaryField label="再生時間" value={duration} />
          </dl>

          <button
            type="button"
            onClick={() => setShowDetails((current) => !current)}
            className="mt-2 text-sm font-medium text-accent hover:underline lg:hidden"
            aria-expanded={showDetails}
          >
            {showDetails ? "詳細を閉じる" : "詳細を見る"}
          </button>

          {showDetails ? (
            <div className="mt-3 space-y-3 border-t border-border pt-3 lg:hidden">
              <dl className="space-y-2 text-sm">
                <SummaryField label="レーベル" value={getDmmItemLabelName(item) ?? "-"} />
                <SummaryField label="シリーズ" value={getDmmItemSeriesName(item) ?? "-"} />
                <SummaryField label="ジャンル" value={getDmmItemGenreNames(item) ?? "-"} />
                <SummaryField label="再生時間" value={duration} />
                <SummaryField label="品番" value={item.content_id} />
              </dl>

              {fanzaUrl ? (
                <p className="text-sm">
                  <a
                    href={fanzaUrl}
                    target="_blank"
                    rel="nofollow sponsored noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    FANZAで見る
                  </a>
                </p>
              ) : null}

              {description ? (
                <div>
                  <p className="text-xs font-medium text-muted">説明文</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {description}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 hidden lg:block">
            {fanzaUrl ? (
              <p className="text-sm">
                <a
                  href={fanzaUrl}
                  target="_blank"
                  rel="nofollow sponsored noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  FANZAで見る
                </a>
              </p>
            ) : null}

            {description ? (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted">説明文</p>
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {description}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={openJsonPanel}
          className={`${ACTION_BUTTON_CLASS} bg-accent text-white hover:bg-accent-hover`}
        >
          追加
        </button>
        <button
          type="button"
          onClick={openSnsPanel}
          className={`${ACTION_BUTTON_CLASS} border border-accent bg-white text-accent hover:bg-[#FFF2F2]`}
        >
          SNS作成
        </button>
        <button
          type="button"
          onClick={() => onExclude(item.content_id)}
          className={`${ACTION_BUTTON_CLASS} border border-border text-foreground hover:border-accent hover:text-accent`}
        >
          除外
        </button>
      </div>

      {showJson ? (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm font-bold text-foreground">追加用JSON</p>
          <p className="mt-1 text-xs text-muted">
            `data/dmm/catalog-snapshot.json` の配列末尾に追加するJSONです。コピーして手動で反映してください。
          </p>
          <pre className="mt-3 max-h-64 overflow-auto rounded border border-border bg-white p-3 text-xs leading-relaxed text-foreground">
            {importJson}
          </pre>
          <button
            type="button"
            onClick={handleCopyJson}
            className="mt-3 inline-flex h-11 min-h-[44px] items-center rounded-lg border border-border px-4 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            {jsonCopied ? "コピーしました" : "JSONをコピー"}
          </button>
        </div>
      ) : null}

      {showSnsPanel && snsType === "" ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-foreground">SNS投稿タイプを選択</p>
            <button
              type="button"
              onClick={() => setShowSnsPanel(false)}
              className="inline-flex h-11 min-h-[44px] items-center text-xs text-muted hover:text-accent"
            >
              閉じる
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSnsTypeChange("recommended-work")}
              className="inline-flex h-11 min-h-[44px] items-center rounded-lg border border-border bg-white px-4 text-sm transition-colors hover:border-accent hover:text-accent"
            >
              {IMPORT_SNS_POST_TYPE_LABELS["recommended-work"]}
            </button>
            <button
              type="button"
              disabled={actressNames.length === 0}
              onClick={() => handleSnsTypeChange("actress")}
              className="inline-flex h-11 min-h-[44px] items-center rounded-lg border border-border bg-white px-4 text-sm transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {IMPORT_SNS_POST_TYPE_LABELS.actress}
            </button>
          </div>
          {actressNames.length === 0 ? (
            <p className="mt-2 text-xs text-muted">
              女優情報がないため「人気女優紹介」は選択できません。
            </p>
          ) : null}
        </div>
      ) : null}

      {showSnsPanel && snsType !== "" ? (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-foreground">
              {IMPORT_SNS_POST_TYPE_LABELS[snsType]}
            </p>
            <button
              type="button"
              onClick={() => handleSnsTypeChange("")}
              className="inline-flex h-11 min-h-[44px] items-center text-xs text-muted hover:text-accent"
            >
              タイプを変更
            </button>
          </div>

          {snsType === "actress" && actressNames.length > 1 ? (
            <label className="mt-3 block text-sm">
              <span className="text-muted">女優を選択</span>
              <select
                value={selectedActress}
                onChange={(event) => {
                  setSelectedActress(event.target.value);
                  setGeneratedPost(null);
                }}
                className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground"
              >
                {actressNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <button
            type="button"
            onClick={handleGenerateSns}
            className="mt-3 inline-flex h-11 min-h-[44px] items-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            投稿文を生成
          </button>

          {generatedPost ? (
            <ImportGeneratedPost
              typeLabel={generatedPost.typeLabel}
              body={generatedPost.body}
            />
          ) : null}
        </div>
      ) : null}

      {showLightbox && imageUrl ? (
        <ImportImageLightbox
          src={imageUrl}
          alt={item.title}
          onClose={() => setShowLightbox(false)}
        />
      ) : null}
    </article>
  );
}
