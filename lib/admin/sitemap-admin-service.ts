import "server-only";

import {
  maybeSubmitSitemapAfterImport,
  submitAllSitemapsToGoogle,
  submitSitemapKeyToGoogle,
  type GoogleSitemapSubmissionResult,
} from "@/lib/admin/sitemap-google-submit";
import {
  refreshAllSitemaps,
  refreshSitemapByKey,
  type SitemapRefreshResult,
} from "@/lib/sitemap/manage";
import { refreshSeoSitemapsOnly } from "@/lib/admin/seo-service";
import type {
  SeoCachePayload,
  SitemapAdminActionResult,
} from "@/lib/admin/seo-types";

function formatRefreshResult(
  result: SitemapRefreshResult,
): NonNullable<SitemapAdminActionResult["refresh"]> {
  const addedText =
    result.addedCount != null
      ? `${result.addedCount >= 0 ? "+" : ""}${result.addedCount}件`
      : "—";

  return {
    key: result.key,
    label: result.label,
    url: result.url,
    urlCount: result.urlCount,
    previousUrlCount: result.previousUrlCount,
    addedCount: result.addedCount,
    duplicateCount: result.duplicateCount,
    httpStatus: result.httpStatus,
    generatedAt: result.generatedAt,
    message: `${result.label}サイトマップを更新しました。 URL数: ${result.urlCount}件 / 追加: ${addedText} / HTTP: ${result.httpStatus}`,
  };
}

function formatSubmitResult(
  result: GoogleSitemapSubmissionResult,
): NonNullable<SitemapAdminActionResult["submit"]> {
  if (result.dryRun) {
    return {
      ...result,
      message: `dry-run: ${result.sitemapUrl} への送信をスキップしました。`,
    };
  }

  if (result.skipped && result.reason === "recently-submitted") {
    return {
      ...result,
      message: "前回送信から30分以内のため、Googleへの再送信を省略しました。",
    };
  }

  if (result.submitted) {
    return {
      ...result,
      message: `Googleへ再送信しました: ${result.sitemapUrl}`,
    };
  }

  return {
    ...result,
    message: result.reason ?? "Googleへの再送信を行いませんでした。",
  };
}

export async function runSitemapRefreshAction(
  key: string,
): Promise<SitemapAdminActionResult> {
  const result = await refreshSitemapByKey(key);
  return {
    refresh: formatRefreshResult(result),
  };
}

export async function runSitemapRefreshAllAction(): Promise<{
  results: NonNullable<SitemapAdminActionResult["refresh"]>[];
}> {
  const results = await refreshAllSitemaps();
  return {
    results: results.map((result) => formatRefreshResult(result)),
  };
}

export async function runSitemapSubmitAction(
  key: string,
): Promise<SitemapAdminActionResult & { data?: SeoCachePayload }> {
  const submit = await submitSitemapKeyToGoogle(key, { skipThrottle: true });
  const data = await refreshSeoSitemapsOnly();
  return { submit: formatSubmitResult(submit), data };
}

export async function runSitemapSubmitAllAction(): Promise<
  SitemapAdminActionResult & { data?: SeoCachePayload }
> {
  const submit = await submitAllSitemapsToGoogle({ skipThrottle: true });
  const data = await refreshSeoSitemapsOnly();
  return { submit: formatSubmitResult(submit), data };
}

export async function handlePostImportSitemapUpdate(): Promise<{
  sitemapUpdated: boolean;
  sitemapError?: string;
  googleSubmission: GoogleSitemapSubmissionResult;
  refreshResults: SitemapRefreshResult[];
}> {
  try {
    const refreshResults = await refreshAllSitemaps();
    const googleSubmission = await maybeSubmitSitemapAfterImport();
    await refreshSeoSitemapsOnly().catch(() => undefined);

    return {
      sitemapUpdated: true,
      googleSubmission,
      refreshResults,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "サイトマップ更新に失敗しました。";
    return {
      sitemapUpdated: false,
      sitemapError: message,
      googleSubmission: {
        submitted: false,
        skipped: true,
        reason: "sitemap-update-failed",
        sitemapUrl: "",
        submittedAt: null,
        dryRun: false,
      },
      refreshResults: [],
    };
  }
}
