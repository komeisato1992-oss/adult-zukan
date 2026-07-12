import "server-only";

import type { InternalLinkAuditResult } from "@/lib/admin/seo-audit-internal-links";
import type { StructuredDataAuditResult } from "@/lib/admin/seo-audit-structured-data";
import { runInternalLinkAudit } from "@/lib/admin/seo-audit-internal-links";
import { runStructuredDataAudit } from "@/lib/admin/seo-audit-structured-data";

type AuditMemory = typeof globalThis & {
  __seoInternalLinkAudit?: InternalLinkAuditResult | null;
  __seoStructuredDataAudit?: StructuredDataAuditResult | null;
};

function store(): AuditMemory {
  return globalThis as AuditMemory;
}

export function getCachedInternalLinkAudit(): InternalLinkAuditResult | null {
  return store().__seoInternalLinkAudit ?? null;
}

export function getCachedStructuredDataAudit(): StructuredDataAuditResult | null {
  return store().__seoStructuredDataAudit ?? null;
}

export async function refreshSeoAudits(): Promise<{
  internalLinks: InternalLinkAuditResult;
  structuredData: StructuredDataAuditResult;
}> {
  const [internalLinks, structuredData] = await Promise.all([
    runInternalLinkAudit(500),
    runStructuredDataAudit(),
  ]);
  store().__seoInternalLinkAudit = internalLinks;
  store().__seoStructuredDataAudit = structuredData;
  return { internalLinks, structuredData };
}

export async function ensureSeoAudits(): Promise<{
  internalLinks: InternalLinkAuditResult | null;
  structuredData: StructuredDataAuditResult | null;
}> {
  const cachedInternal = getCachedInternalLinkAudit();
  const cachedStructured = getCachedStructuredDataAudit();
  if (cachedInternal && cachedStructured) {
    return {
      internalLinks: cachedInternal,
      structuredData: cachedStructured,
    };
  }

  try {
    return await refreshSeoAudits();
  } catch {
    return {
      internalLinks: cachedInternal,
      structuredData: cachedStructured,
    };
  }
}
