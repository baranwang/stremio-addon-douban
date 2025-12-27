import type { AddonBuilder, MetaDetail } from "@stremio-addon/sdk";
import { type Env, Hono } from "hono";
import { api } from "@/libs/api";
import { FanartAPI } from "@/libs/api/fanart";
import { getLatestYearlyRanking, isYearlyRankingId } from "@/libs/collections";
import { getConfig } from "@/libs/config";
import { SECONDS_PER_DAY, SECONDS_PER_WEEK } from "@/libs/constants";
import { getExtraFactory, matchResourceRoute } from "@/libs/router";
import { generateImageUrl, isForwardUserAgent } from "@/libs/utils";

type CatalogResponse = Awaited<ReturnType<Parameters<AddonBuilder["defineCatalogHandler"]>[0]>>;

export const catalogRoute = new Hono<Env>();

catalogRoute.get("*", async (c) => {
  const [matched, params] = matchResourceRoute(c.req.path);

  if (!matched) {
    return c.notFound();
  }

  const config = await getConfig(c.env, params.config);

  const getExtra = getExtraFactory(c, params.extra);

  // 获取豆瓣合集数据
  let collectionId = params.id;
  if (isYearlyRankingId(collectionId)) {
    const latest = getLatestYearlyRanking(collectionId);
    if (!latest) {
      return c.notFound();
    }
    collectionId = latest.id;
  }

  const genre = getExtra("genre");
  if (genre) {
    const category = await api.doubanAPI.getSubjectCollectionCategory(collectionId).catch(() => null);
    const cid = category?.items?.find((item) => item.name === genre)?.id;
    if (cid) {
      collectionId = cid;
    }
  }
  const skip = getExtra("skip") ?? 0;
  const collectionData = await api.doubanAPI.getSubjectCollectionItems(collectionId, skip);
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

  const fanartApi = config.fanart.enabled ? new FanartAPI(config.fanart.apiKey) : null;

  // 构建响应
  const metas = await Promise.all(
    items.map(async (item) => {
      const mapping = mappingCache.get(item.id);
      const { imdbId, tmdbId } = mapping ?? {};
      const [, , genres] = item.card_subtitle?.split("/") ?? [];
      const result: MetaDetail & { [key: string]: any } = {
        id: `douban:${item.id}`,
        name: item.title,
        type: item.type === "tv" ? "series" : "movie",
        poster: generateImageUrl(item.cover ?? "", config.imageProxy),
        description: item.description ?? item.card_subtitle ?? undefined,
        background: item.photos?.[0],
        year: item.year,
        genres: genres?.trim().split(" ") ?? [],
        links: [{ name: `豆瓣评分：${item.rating?.value ?? "N/A"}`, category: "douban", url: item.url ?? "#" }],
      };
      if (fanartApi && (tmdbId || imdbId)) {
        let searchId = tmdbId?.toString();
        if (!searchId && imdbId) {
          searchId = imdbId;
        }
        const images = await fanartApi.getSubjectImages(item.type, searchId);
        if (images) {
          result.poster = images.poster || result.poster;
          result.background = images.background || result.background;
          result.logo = images.logo;
        }
      }
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
    }),
  );

  return c.json({
    metas,
    cacheMaxAge: SECONDS_PER_DAY,
    staleRevalidate: SECONDS_PER_WEEK,
    staleError: SECONDS_PER_WEEK,
  } satisfies CatalogResponse);
});
