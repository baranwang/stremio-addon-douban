import type { MetaDetail, WithCache } from "@stremio-addon/sdk";
import { eq } from "drizzle-orm";
import { type Env, Hono } from "hono";
import { doubanMapping } from "@/db";
import { api } from "@/libs/api";
import { getConfig } from "@/libs/config";
import { matchResourceRoute } from "@/libs/router";
import { generateImageUrl, isForwardUserAgent } from "@/libs/utils";

export const metaRoute = new Hono<Env>();

export const idPrefixes = ["douban:"];
const idPrefixRegex = new RegExp(`^(${idPrefixes.join("|")})`);

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
  const config = await getConfig(c.env, params.config);

  const data = await api.doubanAPI.getSubjectDetail(doubanId);
  const meta: MetaDetail & { [key: string]: any } = {
    id: metaId,
    type: data.type === "tv" ? "series" : "movie",
    name: data.title,
    poster: generateImageUrl(data.cover_url || data.pic?.large || data.pic?.normal || "", config.imageProxy),
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

  if (dbData?.tmdbId) {
    if (isInForward) {
      meta.tmdb_id = `tmdb:${dbData.tmdbId}`;
    } else {
      meta.tmdbId = dbData.tmdbId;
    }
    meta.behaviorHints.defaultVideoId = `tmdb:${dbData.tmdbId}`;
  }
  if (dbData?.imdbId) {
    meta.imdb_id = dbData.imdbId;
    meta.behaviorHints.defaultVideoId = dbData.imdbId;
  }

  return c.json({
    meta,
  } satisfies WithCache<{ meta: MetaDetail }>);
});
