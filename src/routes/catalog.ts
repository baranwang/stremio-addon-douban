import type { AddonBuilder, MetaDetail } from "@stremio-addon/sdk";
import { type Env, Hono } from "hono";
import { api } from "@/libs/api";
import { getLatestYearlyRanking, isYearlyRankingId } from "@/libs/collections";
import { getConfig } from "@/libs/config";
import { SECONDS_PER_DAY, SECONDS_PER_WEEK } from "@/libs/constants";
import { ImageUrlGenerator } from "@/libs/images";
import { getExtraFactory, matchResourceRoute } from "@/libs/router";
import { generateId, getPreferredTitle, isForwardUserAgent } from "@/libs/utils";

type CatalogResponse = Awaited<ReturnType<Parameters<AddonBuilder["defineCatalogHandler"]>[0]>>;

export const catalogRoute = new Hono<Env>();

const getYearFromDate = (value?: string | null) => {
  if (!value) return undefined;
  const match = value.match(/^\d{4}/);
  return match ? match[0] : undefined;
};

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
        title: getPreferredTitle(item.title, item.original_title),
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

  const imageUrlGenerator = new ImageUrlGenerator(config.imageProviders, {
    origin: new URL(c.req.url).origin,
    userId: params.config,
  });

  const tmdbDetailCache = new Map<number, Awaited<ReturnType<typeof api.tmdbAPI.getSubjectDetail>> | null>();
  const getTmdbDetail = async (type: "movie" | "tv", tmdbId?: number | null) => {
    if (!tmdbId) return null;
    if (tmdbDetailCache.has(tmdbId)) {
      return tmdbDetailCache.get(tmdbId) ?? null;
    }
    const detail = await api.tmdbAPI.getSubjectDetail(type, tmdbId, { language: "en-US" }).catch(() => null);
    tmdbDetailCache.set(tmdbId, detail);
    return detail;
  };

  // 构建响应
  const metas = await Promise.all(
    items.map(async (item) => {
      const mapping = mappingCache.get(item.id);
      const { imdbId, tmdbId } = mapping ?? {};
      const [, , genres] = item.card_subtitle?.split("/") ?? [];
      const tmdbDetail = await getTmdbDetail(item.type, tmdbId);
      const englishTitle = tmdbDetail?.title?.trim() || tmdbDetail?.original_title?.trim();
      const englishOverview = tmdbDetail?.overview?.trim();
      const englishGenres = tmdbDetail?.genres?.map((genre) => genre.name).filter(Boolean);
      const englishYear = getYearFromDate(tmdbDetail?.release_date);
      const images = await imageUrlGenerator.generate({
        doubanInfo: item,
        tmdbId,
        imdbId,
      });
      const result: MetaDetail & { [key: string]: any } = {
        id: `douban:${item.id}`,
        type: item.type === "tv" ? "series" : "movie",
        name: englishTitle ?? getPreferredTitle(item.title, item.original_title),
        description: englishOverview ?? item.description ?? item.card_subtitle ?? undefined,
        poster: images.poster,
        background: images.background,
        logo: images.logo,
        year: englishYear ?? item.year,
        genres: englishGenres && englishGenres.length > 0 ? englishGenres : genres?.trim().split(" ") ?? [],
        links: [{ name: `豆瓣评分：${item.rating?.value ?? "N/A"}`, category: "douban", url: item.url ?? "#" }],
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
      if (isInForward) {
        result.id = generateId({ doubanId: item.id, imdbId, tmdbId });
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
