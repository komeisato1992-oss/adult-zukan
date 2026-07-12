import type {
  DmmAiInsights,
  DmmEntityStat,
} from "@/lib/admin/dmm-report-types";

function byRewardDesc(a: DmmEntityStat, b: DmmEntityStat): number {
  return b.reward - a.reward || b.sales - a.sales;
}

function byConversionDesc(a: DmmEntityStat, b: DmmEntityStat): number {
  return (
    b.conversion_rate - a.conversion_rate ||
    b.sales - a.sales ||
    b.clicks - a.clicks
  );
}

function byConversionAsc(a: DmmEntityStat, b: DmmEntityStat): number {
  return (
    a.conversion_rate - b.conversion_rate ||
    b.clicks - a.clicks ||
    a.sales - b.sales
  );
}

export function buildDmmAiInsights(entities: DmmEntityStat[]): DmmAiInsights {
  const works = entities.filter((row) => row.kind === "work");
  const genres = entities.filter((row) => row.kind === "genre");
  const actresses = entities.filter((row) => row.kind === "actress");
  const makers = entities.filter((row) => row.kind === "maker");

  const eligibleWorks = works.filter((row) => row.clicks >= 10);

  return {
    highConversionWorks: [...eligibleWorks]
      .sort(byConversionDesc)
      .filter((row) => row.conversion_rate > 0)
      .slice(0, 5),
    lowConversionWorks: [...eligibleWorks]
      .sort(byConversionAsc)
      .filter((row) => row.clicks >= 20)
      .slice(0, 5),
    topRewardGenres: [...genres].sort(byRewardDesc).slice(0, 5),
    topRewardActresses: [...actresses].sort(byRewardDesc).slice(0, 5),
    topRewardMakers: [...makers].sort(byRewardDesc).slice(0, 5),
  };
}

export function buildDmmInsightSuggestions(insights: DmmAiInsights): Array<{
  id: string;
  text: string;
  priority: 3 | 4 | 5;
}> {
  const suggestions: Array<{
    id: string;
    text: string;
    priority: 3 | 4 | 5;
  }> = [];

  if (insights.highConversionWorks[0]) {
    const top = insights.highConversionWorks[0];
    suggestions.push({
      id: "dmm-high-cvr-work",
      text: `成果率が高い作品「${top.name}」があります（成果率 ${(top.conversion_rate * 100).toFixed(1)}%）。関連ページの内部リンク強化を推奨。`,
      priority: 4,
    });
  }

  if (insights.lowConversionWorks[0]) {
    const low = insights.lowConversionWorks[0];
    suggestions.push({
      id: "dmm-low-cvr-work",
      text: `成果率が低い作品「${low.name}」があります（クリック ${low.clicks} / 成果 ${low.sales}）。タイトル・導線の見直しを推奨。`,
      priority: 3,
    });
  }

  if (insights.topRewardGenres[0]) {
    const genre = insights.topRewardGenres[0];
    suggestions.push({
      id: "dmm-top-genre",
      text: `報酬の多いジャンルは「${genre.name}」です（報酬 ¥${Math.round(genre.reward).toLocaleString("ja-JP")}）。関連作品の追加とSEO強化を推奨。`,
      priority: 4,
    });
  }

  if (insights.topRewardActresses[0]) {
    const actress = insights.topRewardActresses[0];
    suggestions.push({
      id: "dmm-top-actress",
      text: `報酬の多い女優は「${actress.name}」です。女優ページと関連作品の更新を優先してください。`,
      priority: 3,
    });
  }

  if (insights.topRewardMakers[0]) {
    const maker = insights.topRewardMakers[0];
    suggestions.push({
      id: "dmm-top-maker",
      text: `報酬の多いメーカーは「${maker.name}」です。メーカーページの充実を推奨。`,
      priority: 3,
    });
  }

  return suggestions;
}
