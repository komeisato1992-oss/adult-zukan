import type { Campaign } from "./types";

export const campaigns: Campaign[] = [
  {
    id: "spring-sale",
    title: "春のセール開催中",
    description: "人気作品が最大50%OFF。期間限定のお得なセールをチェック。",
    href: "/works?sale=1",
    badge: "SALE",
  },
  {
    id: "new-release",
    title: "最新作続々入荷",
    description: "今週リリースの新作作品をいち早くチェック。",
    href: "/works?sort=new",
    badge: "NEW",
  },
  {
    id: "ranking",
    title: "人気ランキング",
    description: "今最も注目されている作品・女優をランキング形式で紹介。",
    href: "/#ranking",
    badge: "HOT",
  },
];

export function getAllCampaigns(): Campaign[] {
  return campaigns;
}
