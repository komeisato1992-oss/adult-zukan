import "server-only";

import type { CatalogPromoteStatus } from "@/lib/admin/catalog-promote-types";

type PromoteLockStore = typeof globalThis & {
  __adultCatalogPromoteLock?: {
    token: string;
    expiresAt: number;
    status: CatalogPromoteStatus;
  } | null;
};

const LOCK_TTL_MS = 15 * 60 * 1000;

function store(): PromoteLockStore {
  return globalThis as PromoteLockStore;
}

export function getPromoteLockStatus(): CatalogPromoteStatus | null {
  const lock = store().__adultCatalogPromoteLock;
  if (!lock) return null;
  if (Date.now() > lock.expiresAt) {
    store().__adultCatalogPromoteLock = null;
    return null;
  }
  return lock.status;
}

export function tryAcquirePromoteLock(
  status: CatalogPromoteStatus,
): { ok: true; token: string } | { ok: false; status: CatalogPromoteStatus } {
  const existing = store().__adultCatalogPromoteLock;
  if (existing && Date.now() <= existing.expiresAt) {
    return { ok: false, status: existing.status };
  }

  const token = `promote-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  store().__adultCatalogPromoteLock = {
    token,
    expiresAt: Date.now() + LOCK_TTL_MS,
    status,
  };
  return { ok: true, token };
}

export function updatePromoteLockStatus(
  token: string,
  status: CatalogPromoteStatus,
): boolean {
  const lock = store().__adultCatalogPromoteLock;
  if (!lock || lock.token !== token) return false;
  lock.status = status;
  lock.expiresAt = Date.now() + LOCK_TTL_MS;
  return true;
}

export function releasePromoteLock(token: string): void {
  const lock = store().__adultCatalogPromoteLock;
  if (lock && lock.token === token) {
    store().__adultCatalogPromoteLock = null;
  }
}
