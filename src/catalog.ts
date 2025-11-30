import type { ManifestCatalog, MetaPreview, WithCache } from "@stremio-addon/sdk";
import { type Context, type Env, Hono } from "hono";
import type { DoubanIdMapping } from "./db";
import { SECONDS_PER_DAY, SECONDS_PER_WEEK } from "./libs/constants";
import { Douban, douban } from "./libs/douban";
import { matchResourceRoute } from "./libs/router";

const generateId = (doubanId: number, params?: Omit<DoubanIdMapping, "doubanId">) => {
  if (params?.imdbId) {
    return params.imdbId;
  }
  if (params?.tmdbId) {
    return `tmdb:${params.tmdbId}`;
  }
  return `douban:${doubanId}`;
};

export const catalogRouter = new Hono<Env>();

catalogRouter.get("*", async (c) => {
  const [matched, params] = matchResourceRoute(c.req.path);
  if (!matched) {
    return c.json({ error: "Not found" }, 404);
  }

  douban.initialize(c.env);

  // 获取豆瓣合集数据
  const skip = params.extra?.skip ?? c.req.query("skip") ?? 0;
  const collectionData = await douban.getSubjectCollection(params.id, skip);
  if (!collectionData) {
    return c.json({ error: "Not found" }, 404);
  }

  const items = collectionData.subject_collection_items;
  if (items.length === 0) {
    return c.json({ metas: [] } satisfies WithCache<{ metas: MetaPreview[] }>);
  }

  // const doubanIds = items.map((item) => item.id);
  const dataMap = new Map(items.map((item) => [item.id, item]));
  const doubanIds = Array.from(dataMap.keys());
  const { mappingCache, missingIds } = await douban.fetchDoubanIdMapping(doubanIds);

  const newMappings = await Promise.all(
    missingIds.map(async (doubanId) => {
      const item = dataMap.get(doubanId)!;
      return douban.findExternalId({
        doubanId,
        type: item?.type,
        originalTitle: item?.original_title ?? undefined,
        year: item?.year ?? undefined,
      });
    }),
  );

  // 更新本地缓存
  for (const item of newMappings) {
    mappingCache.set(item.doubanId, item);
  }

  // 后台异步写入数据库，不阻塞响应
  c.executionCtx.waitUntil(douban.persistDoubanIdMapping(newMappings));

  // 构建响应
  const metas = items.map<MetaPreview>((item) => {
    return {
      id: generateId(item.id, mappingCache.get(item.id)),
      name: item.title,
      type: item.type === "tv" ? "series" : "movie",
      poster: item.cover ?? "",
      description: item.description ?? undefined,
      background: item.photos?.[0],
    };
  });

  return c.json({
    metas,
    cacheMaxAge: SECONDS_PER_DAY,
    staleRevalidate: SECONDS_PER_WEEK,
    staleError: SECONDS_PER_WEEK,
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
