import catalog from "./catalog/index";
import type { Genre } from "./types";

export const genres: Genre[] = catalog.genres;

export function getAllGenres(): Genre[] {
  return genres;
}

export function getGenreBySlug(slug: string): Genre | undefined {
  return genres.find((genre) => genre.slug === slug);
}
