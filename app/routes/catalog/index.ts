import type { AddonBuilder, ManifestCatalog, MetaPreview } from "@stremio-addon/sdk";
import { type Context, type Env, Hono } from "hono";
import { api, DoubanAPI } from "@/libs/api";
import { SECONDS_PER_DAY, SECONDS_PER_WEEK } from "@/libs/constants";
import { matchResourceRoute } from "@/libs/router";
import { isForwardUserAgent } from "@/libs/utils";
import { generateId } from "./utils";

type CatalogResponse = Awaited<ReturnType<Parameters<AddonBuilder["defineCatalogHandler"]>[0]>>;

const collectionConfigs: Array<ManifestCatalog & { total: number | "fetch" }> = [
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

const collectionIds = collectionConfigs.map((config) => config.id);

export const catalogRouter = new Hono<Env>();

catalogRouter.get("*", async (c) => {
  const [matched, params] = matchResourceRoute(c.req.path);

  if (!matched || !collectionIds.includes(params.id)) {
    return c.notFound();
  }

  api.initialize(c.env, c.executionCtx);

  // 获取豆瓣合集数据
  const skip = params.extra?.skip ?? c.req.query("skip") ?? 0;
  const collectionData = await api.doubanAPI.getSubjectCollection(params.id, skip);
  if (!collectionData) {
    return c.notFound();
  }

  const items = collectionData.subject_collection_items;
  if (items.length === 0) {
    return c.json({ metas: [] } satisfies CatalogResponse);
  }

  const collectionMap = new Map(items.map((item) => [item.id, item]));
  const doubanIds = Array.from(collectionMap.keys());
  const { mappingCache, missingIds } = await api.fetchIdMapping(doubanIds);

  const newMappings = await Promise.all(
    missingIds.map(async (doubanId) => {
      const item = collectionMap.get(doubanId);
      if (!item) {
        return null;
      }
      return api.findExternalId({
        doubanId,
        type: item.type,
        title: item.title,
      });
    }),
  );

  // 更新本地缓存
  for (const item of newMappings) {
    if (item?.doubanId) {
      mappingCache.set(item.doubanId, item);
    }
  }

  // 后台异步写入数据库，不阻塞响应
  c.executionCtx.waitUntil(api.persistIdMapping(newMappings, false));

  const isInForward = isForwardUserAgent(c);

  // 构建响应
  const metas = items.map((item) => {
    const mapping = mappingCache.get(item.id);
    const { imdbId, tmdbId } = mapping ?? {};
    const result: MetaPreview & { [key: string]: any } = {
      id: generateId(item.id, mapping),
      name: item.title,
      type: item.type === "tv" ? "series" : "movie",
      poster: item.cover ?? "",
      description: item.description ?? undefined,
      background: item.photos?.[0],
    };
    if (imdbId) {
      result.imdb_id = imdbId;
    }
    if (tmdbId) {
      if (isInForward) {
        result.tmdb_id = `tmdb:${tmdbId}`;
      } else {
        result.tmdbId = tmdbId;
      }
    }

    return result;
  });

  return c.json({
    metas,
    cacheMaxAge: SECONDS_PER_DAY,
    staleRevalidate: SECONDS_PER_WEEK,
    staleError: SECONDS_PER_WEEK,
  } satisfies CatalogResponse);
});

export default catalogRouter;

export const getCatalogs = async (c: Context<Env>) => {
  api.initialize(c.env, c.executionCtx);

  const catalogs = await Promise.allSettled(
    collectionConfigs.map(async (catalog) => {
      const result: ManifestCatalog & { total: number } = {
        ...catalog,
        total: catalog.total === "fetch" ? 0 : catalog.total,
      };
      if (catalog.total === "fetch") {
        const data = await api.doubanAPI.getSubjectCollection(catalog.id, 0);
        result.total = data?.total ?? 0;
      }
      if (result.total > 10) {
        result.extra ??= [];
        result.extra.push({
          name: "skip",
          options: Array.from(
            {
              length: Math.ceil(result.total / DoubanAPI.PAGE_SIZE),
            },
            (_, i) => (i * DoubanAPI.PAGE_SIZE).toString(),
          ),
        });
      }
      return result;
    }),
  );
  return catalogs.filter((v) => v.status === "fulfilled").map((v) => v.value);
};
