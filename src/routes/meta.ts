import type { MetaDetail, WithCache } from "@stremio-addon/sdk";
import { eq } from "drizzle-orm";
import { type Env, Hono } from "hono";
import { doubanMapping } from "@/db";
import { api } from "@/libs/api";
import { getConfig } from "@/libs/config";
import { ImageUrlGenerator } from "@/libs/images";
import { matchResourceRoute } from "@/libs/router";
import { getPreferredTitle, isForwardUserAgent } from "@/libs/utils";

export const metaRoute = new Hono<Env>();

export const idPrefixes = ["douban:"];
const idPrefixRegex = new RegExp(`^(${idPrefixes.join("|")})`);

const getYearFromDate = (value?: string | null) => {
  if (!value) return undefined;
  const match = value.match(/^\d{4}/);
  return match ? match[0] : undefined;
};

metaRoute.get("*", async (c) => {
  const [matched, params] = matchResourceRoute(c.req.path);
  if (!matched) {
    return c.notFound();
  }
  const metaId = params.id;
  if (!idPrefixRegex.test(metaId)) {
    return c.notFound();
  }

  let doubanId: number | undefined;
  if (metaId.startsWith("douban:")) {
    doubanId = Number.parseInt(metaId.split(":")[1], 10);
  }
  if (!doubanId) {
    return c.notFound();
  }

  const data = await api.doubanAPI.getSubjectDetail(doubanId);
  if (!data) {
    return c.notFound();
  }

  const meta: MetaDetail & { [key: string]: any } = {
    id: metaId,
    type: data.type === "tv" ? "series" : "movie",
    name: getPreferredTitle(data.title, data.original_title),
    description: data.intro ?? undefined,
    genres: data.genres ?? undefined,
    links: [
      { name: `豆瓣评分：${data.rating?.value ?? "N/A"}`, category: "douban", url: data.url ?? "" },
      ...data.linewatches.map((item) => ({
        name: item.source.name,
        category: "linewatches",
        url: item.source_uri ?? "",
      })),
      ...(data.directors ?? []).map((item) => ({ name: item.name, category: "director", url: "#" })),
      ...(data.actors ?? []).map((item) => ({ name: item.name, category: "actor", url: "#" })),
    ],
    language: data.languages?.join(" / "),
    country: data.countries?.join(" / "),
    awards: data.honor_infos?.map((item) => item.title).join(" / "),
  };
  meta.behaviorHints ||= {};
  const isInForward = isForwardUserAgent(c);

  const dbData = await api.db.query.doubanMapping.findFirst({ where: eq(doubanMapping.doubanId, doubanId) });
  if (!dbData) {
    c.executionCtx.waitUntil(api.db.insert(doubanMapping).values({ doubanId }));
  }

  const { tmdbId, imdbId } = dbData || {};
  const tmdbDetail = tmdbId
    ? await api.tmdbAPI.getSubjectDetail(data.type, tmdbId, { language: "en-US" }).catch(() => null)
    : null;
  const englishTitle = tmdbDetail?.title?.trim() || tmdbDetail?.original_title?.trim();
  const englishOverview = tmdbDetail?.overview?.trim();
  const englishGenres = tmdbDetail?.genres?.map((genre) => genre.name).filter(Boolean);
  const englishYear = getYearFromDate(tmdbDetail?.release_date);

  if (tmdbId) {
    if (isInForward) {
      meta.tmdb_id = `tmdb:${tmdbId}`;
    } else {
      meta.tmdbId = tmdbId;
    }
    meta.behaviorHints.defaultVideoId = `tmdb:${tmdbId}`;
  }
  if (imdbId) {
    meta.imdb_id = imdbId;
    meta.behaviorHints.defaultVideoId = imdbId;
  }

  const config = await getConfig(c.env, params.config);
  const imageUrlGenerator = new ImageUrlGenerator(config.imageProviders, {
    origin: new URL(c.req.url).origin,
    userId: params.config,
  });
  const images = await imageUrlGenerator.generate({
    doubanInfo: {
      cover: data.cover_url || data.pic?.large || data.pic?.normal || "",
      type: data.type,
    },
    tmdbId,
    imdbId,
  });
  meta.poster = images.poster;
  meta.background = images.background;
  meta.logo = images.logo;
  if (englishTitle) {
    meta.name = englishTitle;
  }
  if (englishOverview) {
    meta.description = englishOverview;
  }
  if (englishGenres && englishGenres.length > 0) {
    meta.genres = englishGenres;
  }
  if (englishYear) {
    meta.year = englishYear;
  }

  return c.json({
    meta,
  } satisfies WithCache<{ meta: MetaDetail }>);
});
