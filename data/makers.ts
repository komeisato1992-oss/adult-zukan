import catalog from "./catalog/index";
import type { Maker } from "./types";

export const makers: Maker[] = catalog.makers;

export function getAllMakers(): Maker[] {
  return makers;
}

export function getMakerBySlug(slug: string): Maker | undefined {
  return makers.find((maker) => maker.slug === slug);
}

export function getRankedMakers(limit = 10): Maker[] {
  return [...makers].slice(0, limit);
}
