import type { ManifestCatalog, MetaPreview, WithCache } from "@stremio-addon/sdk";
import { inArray } from "drizzle-orm";
import { type Env, Hono } from "hono";
import { z } from "zod";
import { doubanMapping, getDrizzle } from "./db";
import { doubanSubjectCollectionCache, doubanSubjectDetailCache } from "./libs/caches";
import { tmdbHttp } from "./libs/http";
import { matchResourceRoute } from "./libs/router";
import {
  type DoubanSubjectCollectionItem,
  type tmdbSearchResultItemSchema,
  tmdbSearchResultSchema,
} from "./libs/schema";

export const catalogRouter = new Hono<Env>();

/** 从候选结果中精确匹配 TMDB ID */
async function matchTmdbFromCandidates(
  candidates: z.output<typeof tmdbSearchResultItemSchema>[],
  item: DoubanSubjectCollectionItem,
  originalTitle: string | undefined | null,
): Promise<number | null> {
  const byName = candidates.filter((v) => v.finalName === item.title);
  if (byName.length === 1) return byName[0].id;

  const toMatch = byName.length > 1 ? byName : candidates;

  if (originalTitle) {
    const byOriginal = toMatch.filter((v) => v.finalOriginalName === originalTitle);
    if (byOriginal.length === 1) return byOriginal[0].id;
    if (byOriginal.length > 1) {
      console.warn("无法精准匹配 TMDB ID (多个原始标题匹配):", byOriginal, item);
    }
  }

  return null;
}

/** 从 TMDB 搜索单个条目的 ID */
async function searchTmdbId(item: DoubanSubjectCollectionItem): Promise<number | null> {
  let originalTitle = item.original_title;
  if (!originalTitle) {
    const detail = await doubanSubjectDetailCache.fetch(item.id.toString());
    originalTitle = detail?.original_title;
  }
  const resp = await tmdbHttp.get(`/search/${item.type}`, {
    params: {
      query: originalTitle || item.title,
      language: "zh-CN",
      year: item.year,
    },
  });
  const { success, data, error } = tmdbSearchResultSchema.safeParse(resp.data);
  if (!success) {
    console.warn(z.prettifyError(error));
    return null;
  }

  if (data.results.length === 0) return null;
  if (data.results.length === 1) return data.results[0].id;

  return matchTmdbFromCandidates(data.results, item, originalTitle);
}

catalogRouter.get("*", async (c) => {
  const [matched, params] = matchResourceRoute(c.req.path);
  if (!matched) {
    return c.json({ error: "Not found" }, 404);
  }

  const db = getDrizzle(c.env);

  // 1. 获取豆瓣集合数据
  const data = await doubanSubjectCollectionCache.fetch(`${params.id}:${params.extra?.skip ?? 0}`);
  if (!data) {
    return c.json({ error: "Not found" }, 404);
  }
  const items = data.subject_collection_items;
  if (items.length === 0) {
    return c.json({ metas: [] } satisfies WithCache<{ metas: MetaPreview[] }>);
  }

  // 2. 批量查询数据库中已有的映射
  const doubanIds = items.map((item) => item.id);
  const existingMappings = await db
    .select({ doubanId: doubanMapping.doubanId, tmdbId: doubanMapping.tmdbId })
    .from(doubanMapping)
    .where(inArray(doubanMapping.doubanId, doubanIds));

  const mappingCache = new Map(existingMappings.map((m) => [m.doubanId, m.tmdbId]));

  // 3. 对缺失映射的条目并行搜索 TMDB
  const missingItems = items.filter((item) => !mappingCache.has(item.id));
  const searchResults = await Promise.all(missingItems.map((item) => searchTmdbId(item)));

  // 4. 批量插入新映射到数据库
  const newMappings: { doubanId: number; tmdbId: number }[] = [];
  for (const [i, item] of missingItems.entries()) {
    const tmdbId = searchResults[i];
    if (tmdbId) {
      mappingCache.set(item.id, tmdbId);
      newMappings.push({ doubanId: item.id, tmdbId });
    }
  }
  if (newMappings.length > 0) {
    await db.insert(doubanMapping).values(newMappings);
  }

  const metas = items.map<MetaPreview>((item) => ({
    id: mappingCache.has(item.id) ? `tmdb:${mappingCache.get(item.id)}` : `douban:${item.id}`,
    name: item.title,
    type: item.type === "tv" ? "series" : "movie",
    poster: item.cover ?? "",
    description: item.description ?? undefined,
    background: item.photos?.[0] ?? undefined,
  }));

  return c.json({
    metas,
    cacheMaxAge: 60 * 60 * 24,
    staleRevalidate: 60 * 60 * 24 * 7,
    staleError: 60 * 60 * 24 * 7,
  } satisfies WithCache<{ metas: MetaPreview[] }>);
});

export const getCatalogs = async () => {
  const collectionIds: Array<ManifestCatalog & { total: number | "fetch" }> = [
    { id: "movie_hot_gaia", name: "豆瓣热门电影", type: "movie", total: "fetch" },
    { id: "tv_hot", name: "豆瓣热播剧集", type: "series", total: "fetch" },
    { id: "show_hot", name: "豆瓣热播综艺", type: "series", total: "fetch" },
    { id: "tv_animation", name: "豆瓣热门动画", type: "series", total: "fetch" },
    { id: "movie_showing", name: "豆瓣影院热映", type: "movie", total: "fetch" },
    { id: "movie_real_time_hotest", name: "豆瓣实时热门电影", type: "movie", total: 10 },
    { id: "tv_real_time_hotest", name: "豆瓣实时热门电视", type: "series", total: 10 },
    { id: "movie_top250", name: "豆瓣电影 Top250", type: "movie", total: 250 },
    { id: "movie_weekly_best", name: "豆瓣一周口碑电影榜", type: "movie", total: 10 },
    { id: "tv_chinese_best_weekly", name: "豆瓣华语口碑剧集榜", type: "series", total: 10 },
    { id: "tv_global_best_weekly", name: "豆瓣全球口碑剧集榜", type: "series", total: 10 },
    { id: "show_chinese_best_weekly", name: "豆瓣华语口碑综艺榜", type: "series", total: 10 },
    { id: "show_global_best_weekly", name: "豆瓣全球口碑综艺榜", type: "series", total: 10 },
  ];
  const catalogs = await Promise.allSettled(
    collectionIds.map(async (catalog) => {
      const result: ManifestCatalog & { total: number } = {
        ...catalog,
        total: catalog.total === "fetch" ? 0 : catalog.total,
      };
      if (catalog.total === "fetch") {
        const data = await doubanSubjectCollectionCache.fetch(`${catalog.id}:0`);
        result.total = data?.total ?? 0;
      }
      if (result.total > 10) {
        result.extra ??= [];
        result.extra.push({
          name: "skip",
          options: Array.from({ length: Math.ceil(result.total / 10) }, (_, i) => (i * 10).toString()),
        });
      }
      return result;
    }),
  );
  return catalogs.filter((v) => v.status === "fulfilled").map((v) => v.value);
};
