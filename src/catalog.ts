import type { ManifestCatalog, MetaPreview, WithCache } from "@stremio-addon/sdk";
import { and, inArray, isNotNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { type Context, type Env, Hono } from "hono";
import { doubanMapping } from "./db";
import { Douban, douban } from "./libs/douban";
import { matchResourceRoute } from "./libs/router";

export const catalogRouter = new Hono<Env>();

catalogRouter.get("*", async (c) => {
  const [matched, params] = matchResourceRoute(c.req.path);
  if (!matched) {
    return c.json({ error: "Not found" }, 404);
  }

  douban.initialize(c.env);

  const collectionData = await douban.getSubjectCollection(params.id, params.extra?.skip);
  if (!collectionData) {
    return c.json({ error: "Not found" }, 404);
  }
  const items = collectionData.subject_collection_items;
  if (!items.length) {
    return c.json({ metas: [] } satisfies WithCache<{ metas: MetaPreview[] }>);
  }

  // 2. 批量查询数据库中已有的映射
  const db = drizzle(c.env.stremio_addon_douban);
  const doubanIds = items.map((item) => item.id);
  const existingMappings = await db
    .select({ doubanId: doubanMapping.doubanId, imdbId: doubanMapping.imdbId })
    .from(doubanMapping)
    .where(and(inArray(doubanMapping.doubanId, doubanIds), isNotNull(doubanMapping.imdbId)));
  const mappingCache = new Map(existingMappings.map((m) => [m.doubanId, m.imdbId]));

  // 3. 对缺失映射的条目并行搜索 IMDb
  const missingItems = items.filter((item) => !mappingCache.has(item.id));
  const searchResults = await Promise.allSettled(
    missingItems.map(async (item) => {
      const info = await douban.getSubjectDetailDesc(item.id);
      return info?.IMDb ?? null;
    }),
  );

  // 4. 批量插入新映射到数据库
  const newMappings: { doubanId: number; imdbId: string }[] = [];
  for (const [i, item] of missingItems.entries()) {
    const imdbId = searchResults[i].status === "fulfilled" ? searchResults[i].value : null;
    if (imdbId) {
      mappingCache.set(item.id, imdbId);
      newMappings.push({ doubanId: item.id, imdbId });
    }
  }
  if (newMappings.length > 0) {
    await db
      .insert(doubanMapping)
      .values(newMappings)
      .onConflictDoUpdate({
        target: doubanMapping.doubanId,
        set: { imdbId: sql`excluded.imdb_id` },
      });
  }

  const metas = items.map<MetaPreview>((item) => {
    const imdbId = mappingCache.get(item.id);
    return {
      id: imdbId ?? `douban:${item.id}`,
      name: item.title,
      type: item.type === "tv" ? "series" : "movie",
      poster: item.cover ?? "",
      description: item.description ?? undefined,
      background: item.photos?.[0] ?? undefined,
    };
  });

  return c.json({
    metas,
    cacheMaxAge: 60 * 60 * 24,
    staleRevalidate: 60 * 60 * 24 * 7,
    staleError: 60 * 60 * 24 * 7,
  } satisfies WithCache<{ metas: MetaPreview[] }>);
});

export const getCatalogs = async (c: Context<Env>) => {
  douban.initialize(c.env);

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
        const data = await douban.getSubjectCollection(catalog.id, 0);
        result.total = data?.total ?? 0;
      }
      if (result.total > 10) {
        result.extra ??= [];
        result.extra.push({
          name: "skip",
          options: Array.from(
            {
              length: Math.ceil(result.total / Douban.PAGE_SIZE),
            },
            (_, i) => (i * Douban.PAGE_SIZE).toString(),
          ),
        });
      }
      return result;
    }),
  );
  return catalogs.filter((v) => v.status === "fulfilled").map((v) => v.value);
};
