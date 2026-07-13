import { brand } from "@/lib/brand";
import { doujinBrand } from "@/lib/doujin/brand";

/**
 * マルチサイト設定の入口。
 * 既存アダルト図鑑と同人図鑑の識別情報を一元管理する。
 */
export const multiSiteConfig = {
  adult: {
    name: "アダルト図鑑",
    basePath: "",
    primaryColor: brand.primary,
  },
  doujin: {
    name: "同人図鑑",
    basePath: "/doujin",
    primaryColor: doujinBrand.primary,
  },
} as const;

export type SiteKey = keyof typeof multiSiteConfig;
