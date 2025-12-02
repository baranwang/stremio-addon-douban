import type { DoubanIdMapping } from "../../db";

export const generateId = (doubanId: number, params?: Partial<Omit<DoubanIdMapping, "doubanId">>) => {
  if (params?.imdbId) {
    return params.imdbId;
  }
  if (params?.tmdbId) {
    return `tmdb:${params.tmdbId}`;
  }
  return `douban:${doubanId}`;
};
