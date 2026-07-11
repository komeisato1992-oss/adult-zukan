export function formatSeoStarRating(score: number): string {
  if (score >= 400) return "★★★★★";
  if (score >= 300) return "★★★★☆";
  if (score >= 200) return "★★★☆☆";
  if (score >= 100) return "★★☆☆☆";
  return "★☆☆☆☆";
}
