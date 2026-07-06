export function encodeActressSlug(name: string): string {
  return encodeURIComponent(name);
}

export function decodeActressSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export function getActressDetailPath(name: string): string {
  return `/actresses/${encodeActressSlug(name)}`;
}

export function matchesActressSlug(actressName: string, slug: string): boolean {
  return actressName === decodeActressSlug(slug);
}
