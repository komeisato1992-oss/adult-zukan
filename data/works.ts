import catalog from "./catalog/index";
import type { Work } from "./types";

export const fallbackWorks: Work[] = catalog.works;

export function getFallbackWorks(): Work[] {
  return catalog.works;
}
