/** ランキング分析は廃止。互換のため空配列を返す */

export type DmmAiInsights = {
  highConversionWorks: [];
  lowConversionWorks: [];
  topRewardGenres: [];
  topRewardActresses: [];
  topRewardMakers: [];
};

export function buildDmmAiInsights(_entities: unknown[] = []): DmmAiInsights {
  return {
    highConversionWorks: [],
    lowConversionWorks: [],
    topRewardGenres: [],
    topRewardActresses: [],
    topRewardMakers: [],
  };
}

export function buildDmmInsightSuggestions(_insights: DmmAiInsights) {
  return [] as Array<{ id: string; text: string; priority: 3 | 4 | 5 }>;
}
