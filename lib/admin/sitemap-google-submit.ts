import "server-only";

import { getSiteUrl } from "@/lib/constants";
import { submitSitemap } from "@/lib/admin/google-search-console";
import { getSeoConfigStatus } from "@/lib/admin/seo-config";
import { getSearchConsoleSiteUrl } from "@/lib/admin/google-search-console";
import {
  buildSitemapDefinitions,
  findSitemapDefinitionByKey,
} from "@/lib/sitemap/definitions";
import { previewSitemapValidationByKey } from "@/lib/sitemap/manage";
import { getCatalogWorks } from "@/lib/catalog";

const SUBMIT_THROTTLE_MS = 30 * 60 * 1000;

type SubmitStore = typeof globalThis & {
  __sitemapSubmitState?: {
    lastSubmittedAt: string | null;
    lastSubmittedUrl: string | null;
  };
};

function getSubmitStore(): SubmitStore {
  return globalThis as SubmitStore;
}

export type GoogleSitemapSubmissionResult = {
  submitted: boolean;
  skipped: boolean;
  reason: string | null;
  sitemapUrl: string;
  submittedAt: string | null;
  dryRun: boolean;
};

export function isSitemapSubmitEnabled(): boolean {
  const flag = process.env.SITEMAP_SUBMIT_ENABLED?.trim().toLowerCase();
  if (flag === "false") return false;
  if (flag === "true") return true;
  return process.env.VERCEL_ENV === "production";
}

function readSubmitState() {
  const store = getSubmitStore();
  return (
    store.__sitemapSubmitState ?? {
      lastSubmittedAt: null,
      lastSubmittedUrl: null,
    }
  );
}

function writeSubmitState(submittedAt: string, sitemapUrl: string): void {
  const store = getSubmitStore();
  store.__sitemapSubmitState = {
    lastSubmittedAt: submittedAt,
    lastSubmittedUrl: sitemapUrl,
  };
}

export function getLastGoogleSitemapSubmission(): {
  submittedAt: string | null;
  sitemapUrl: string | null;
} {
  const state = readSubmitState();
  return {
    submittedAt: state.lastSubmittedAt,
    sitemapUrl: state.lastSubmittedUrl,
  };
}

async function ensureSitemapIsFetchable(key: string): Promise<void> {
  const validation = await previewSitemapValidationByKey(key);
  if (!validation.ok) {
    throw new Error(
      `サイトマップ検証に失敗しました: ${validation.errors.join(" ")}`,
    );
  }
}

export async function submitSitemapToGoogle(options: {
  sitemapUrl: string;
  skipThrottle?: boolean;
}): Promise<GoogleSitemapSubmissionResult> {
  const config = getSeoConfigStatus();
  if (!config.configured) {
    return {
      submitted: false,
      skipped: true,
      reason: "search-console-unconfigured",
      sitemapUrl: options.sitemapUrl,
      submittedAt: null,
      dryRun: !isSitemapSubmitEnabled(),
    };
  }

  if (!isSitemapSubmitEnabled()) {
    console.info("[sitemap-submit] dry-run", {
      sitemapUrl: options.sitemapUrl,
    });
    return {
      submitted: false,
      skipped: true,
      reason: "local-dry-run",
      sitemapUrl: options.sitemapUrl,
      submittedAt: null,
      dryRun: true,
    };
  }

  const state = readSubmitState();
  if (!options.skipThrottle && state.lastSubmittedAt) {
    const elapsed = Date.now() - new Date(state.lastSubmittedAt).getTime();
    if (elapsed < SUBMIT_THROTTLE_MS) {
      return {
        submitted: false,
        skipped: true,
        reason: "recently-submitted",
        sitemapUrl: options.sitemapUrl,
        submittedAt: state.lastSubmittedAt,
        dryRun: false,
      };
    }
  }

  const siteUrl = getSearchConsoleSiteUrl();
  await submitSitemap(siteUrl, options.sitemapUrl);
  const submittedAt = new Date().toISOString();
  writeSubmitState(submittedAt, options.sitemapUrl);

  return {
    submitted: true,
    skipped: false,
    reason: null,
    sitemapUrl: options.sitemapUrl,
    submittedAt,
    dryRun: false,
  };
}

export async function submitSitemapKeyToGoogle(
  key: string,
  options?: { skipThrottle?: boolean },
): Promise<GoogleSitemapSubmissionResult> {
  const works = await getCatalogWorks();
  const definition = findSitemapDefinitionByKey(key, works.length);
  if (!definition) {
    throw new Error(`未知のサイトマップキーです: ${key}`);
  }

  if (definition.kind === "urlset") {
    await ensureSitemapIsFetchable(definition.key);
  } else {
    await ensureSitemapIsFetchable("index");
  }

  return submitSitemapToGoogle({
    sitemapUrl: definition.url,
    skipThrottle: options?.skipThrottle,
  });
}

export async function submitAllSitemapsToGoogle(options?: {
  skipThrottle?: boolean;
}): Promise<GoogleSitemapSubmissionResult> {
  const index = buildSitemapDefinitions({ siteUrl: getSiteUrl() }).find(
    (definition) => definition.key === "index",
  );
  if (!index) {
    throw new Error("サイトマップインデックスが見つかりません。");
  }

  await ensureSitemapIsFetchable("index");
  return submitSitemapToGoogle({
    sitemapUrl: index.url,
    skipThrottle: options?.skipThrottle,
  });
}

export async function maybeSubmitSitemapAfterImport(): Promise<GoogleSitemapSubmissionResult> {
  return submitAllSitemapsToGoogle();
}
