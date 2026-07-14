/** スマートフォン作品一覧グリッド（PC ≥769px は従来の3→4列） */
export const WORK_LIST_GRID_CLASSNAME =
  "grid grid-cols-2 gap-1.5 min-[390px]:grid-cols-3 min-[390px]:gap-1.5 min-[769px]:grid-cols-3 min-[769px]:gap-4 lg:grid-cols-4";

/** 関連作品など（モバイルは390px〜3列、比較類似は別指定） */
export const WORK_RELATED_GRID_CLASSNAME =
  "grid grid-cols-2 gap-1.5 min-[390px]:grid-cols-3 min-[390px]:gap-1.5 min-[769px]:grid-cols-3 min-[769px]:gap-4 lg:grid-cols-4";

/** 比較ページの類似作品（モバイルは2列維持） */
export const COMPARE_RELATED_GRID_CLASSNAME =
  "grid grid-cols-2 gap-2 min-[769px]:grid-cols-3 min-[1100px]:grid-cols-4 min-[1400px]:grid-cols-5";
