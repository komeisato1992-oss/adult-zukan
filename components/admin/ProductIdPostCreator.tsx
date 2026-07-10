"use client";

import { useState } from "react";
import type { ProductCodeCandidate, SnsScheduledPost } from "@/lib/admin/sns-types";
import { buildImageProxyUrl } from "@/lib/image-proxy";
import { isValidImageUrl } from "@/lib/works";

type ProductIdPostCreatorProps = {
  onCreated: (post: SnsScheduledPost) => void;
};

const inputClassName =
  "min-h-[44px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

const buttonClassName =
  "inline-flex h-11 min-h-[44px] shrink-0 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60";

function CandidateImage({ imageUrl, title }: { imageUrl?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const src =
    imageUrl && isValidImageUrl(imageUrl) && !failed
      ? buildImageProxyUrl(imageUrl)
      : null;

  if (!src) {
    return (
      <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded border border-border bg-surface text-[10px] text-muted">
        No img
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      className="h-16 w-12 shrink-0 rounded border border-border object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function ProductIdPostCreator({ onCreated }: ProductIdPostCreatorProps) {
  const [productCode, setProductCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ProductCodeCandidate[] | null>(
    null,
  );

  async function requestPost(payload: {
    productCode?: string;
    contentId?: string;
  }) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/sns/create-recommended", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        post?: SnsScheduledPost;
        candidates?: ProductCodeCandidate[];
        error?: string;
      };

      if (!response.ok) {
        setCandidates(null);
        setError(data.error ?? "投稿の生成に失敗しました。");
        return;
      }

      if (data.candidates && data.candidates.length > 0) {
        setCandidates(data.candidates);
        return;
      }

      if (data.post) {
        setCandidates(null);
        onCreated(data.post);
      }
    } catch {
      setCandidates(null);
      setError("投稿の生成に失敗しました。通信状況を確認してください。");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = productCode.trim();
    if (!trimmed) {
      setCandidates(null);
      setError("製品番号を入力してください。");
      return;
    }

    await requestPost({ productCode: trimmed });
  }

  async function handleSelectCandidate(contentId: string) {
    await requestPost({ productCode: productCode.trim(), contentId });
  }

  return (
    <section className="w-full max-w-full overflow-hidden rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-bold text-foreground">製品番号から投稿を作成</h2>
      <p className="mt-1 text-sm text-muted">
        製品番号・content_idを入力して「今日のおすすめ作品」の下書きを生成します。
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex w-full max-w-full flex-col gap-3 sm:flex-row sm:items-end"
      >
        <label className="min-w-0 flex-1 space-y-1">
          <span className="sr-only">製品番号・content_idを入力</span>
          <input
            type="text"
            value={productCode}
            onChange={(event) => {
              setProductCode(event.target.value);
              if (error) setError(null);
            }}
            placeholder="製品番号・content_idを入力（例: 1dldss00509, cemd00696, JUQ-123）"
            className={inputClassName}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" disabled={loading} className={buttonClassName}>
          {loading ? "生成中..." : "おすすめ投稿を作成"}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {candidates && candidates.length > 0 ? (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-3 sm:p-4">
          <p className="text-sm font-medium text-foreground">
            複数の候補が見つかりました。対象作品を選択してください。
          </p>
          <ul className="space-y-2">
            {candidates.map((candidate) => (
              <li key={candidate.contentId}>
                <button
                  type="button"
                  onClick={() => handleSelectCandidate(candidate.contentId)}
                  disabled={loading}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-white p-3 text-left transition-colors hover:border-accent hover:bg-accent-light/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CandidateImage
                    imageUrl={candidate.imageUrl}
                    title={candidate.title}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium text-foreground">
                      {candidate.title}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {candidate.contentId}
                      {candidate.productId !== candidate.contentId
                        ? ` / ${candidate.productId}`
                        : ""}
                    </span>
                    {candidate.actressNames ? (
                      <span className="mt-1 block text-xs text-muted">
                        女優：{candidate.actressNames}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
