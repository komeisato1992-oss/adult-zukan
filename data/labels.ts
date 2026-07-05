import catalog from "./catalog/index";
import type { Label } from "./types";

export const labels: Label[] = catalog.labels;

export function getAllLabels(): Label[] {
  return labels;
}

export function getLabelBySlug(slug: string): Label | undefined {
  return labels.find((label) => label.slug === slug);
}

export function getLabelsByMaker(makerSlug: string): Label[] {
  return labels.filter((label) => label.makerSlug === makerSlug);
}

export function getRankedLabels(limit = 10): Label[] {
  return labels.slice(0, limit);
}
