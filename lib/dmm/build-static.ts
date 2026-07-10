import "server-only";

/**
 * ビルド時に事前生成する静的パラメータ数。
 * 0 = ビルド時は生成せず、初回アクセス時に ISR（dynamicParams + revalidate）。
 * 環境変数 BUILD_STATIC_GENERATION_LIMIT で上書き可能。
 */
export const BUILD_STATIC_GENERATION_LIMIT = Number.parseInt(
  process.env.BUILD_STATIC_GENERATION_LIMIT ?? "0",
  10,
);

export function getBuildStaticGenerationLimit(): number {
  const limit = BUILD_STATIC_GENERATION_LIMIT;
  return Number.isFinite(limit) && limit > 0 ? limit : 0;
}
