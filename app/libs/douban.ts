import {
  type SearchMovieResultResponse,
  type SearchResultResponse,
  type SearchShowResultResponse,
  searchResultResponseSchema,
  Environment as TraktBaseUrl,
} from "@trakt/api";
import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { load as cheerioLoad } from "cheerio";
import { inArray, isNull, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Context, Env } from "hono";
import z from "zod";
import { type DoubanIdMapping, doubanMapping } from "../db";
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from "./constants";
import { doubanSubjectCollectionSchema, doubanSubjectDetailSchema } from "./schema";

interface FindTmdbIdParams {
  type: "movie" | "tv";
  doubanId: number;
  title?: string;
}

export class Douban {
  static PAGE_SIZE = 10;

  private _context?: Context<Env>;

  get context() {
    if (!this._context) {
      throw new Error("Context not initialized");
    }
    return this._context;
  }
  set context(context: Context<Env>) {
    this._context = context;
  }

  private axios: AxiosInstance;

  constructor() {
    this.axios = axios.create({
      baseURL: "https://frodo.douban.com/api/v2",
      adapter: "fetch",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/99/page-frame.html",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Mac MacWechat/WMPF MacWechat/3.8.7(0x13080712) UnifiedPCMacWechat(0xf264101d) XWEB/16390",
      },
    });
    this.axios.interceptors.request.use(async (config) => {
      const finalUri = axios.getUri(config);
      if (finalUri.startsWith("https://frodo.douban.com/")) {
        config.params ||= {};
        config.params.apiKey = this.context.env.DOUBAN_API_KEY || process.env.DOUBAN_API_KEY;
      }
      if (finalUri.startsWith(TraktBaseUrl.production)) {
        config.headers.set("trakt-api-version", "2");
        config.headers.set("trakt-api-key", this.context.env.TRAKT_CLIENT_ID || process.env.TRAKT_CLIENT_ID);
      }
      console.info("⬆️", config.method?.toUpperCase(), finalUri);
      return config;
    });
  }

  private async request<T>(config: AxiosRequestConfig & { cache?: { key: string; ttl: number } }) {
    const cache = caches.default;
    const cacheKey = new Request(`https://cache.internal/${config.cache?.key}`);

    if (config.cache) {
      const cachedRes = await cache.match(cacheKey);
      if (cachedRes) {
        console.info("⚡️ Cache Hit", config.cache.key);
        return cachedRes.json() as T;
      }
      console.info("🐢 Cache Miss", config.cache.key);
    }

    const resp = await this.axios.request<T>(config);
    if (config.cache) {
      const response = new Response(JSON.stringify(resp.data), {
        headers: {
          "Cache-Control": `public, max-age=${config.cache.ttl / 1000}, s-maxage=${config.cache.ttl / 1000}`,
        },
      });
      this.context.executionCtx.waitUntil(cache.put(cacheKey, response));
    }
    return resp.data;
  }

  initialize(context: Context<Env>) {
    this.context = context;
  }

  get db() {
    return drizzle(this.context.env.STREMIO_ADDON_DOUBAN);
  }

  //#region Subject Collection
  async getSubjectCollection(collectionId: string, skip: string | number = 0) {
    const resp = await this.request({
      url: `/subject_collection/${collectionId}/items`,
      params: {
        start: skip,
        count: Douban.PAGE_SIZE,
      },
      cache: {
        key: `subject_collection:${collectionId}:${skip}`,
        ttl: 1000 * SECONDS_PER_HOUR * 2,
      },
    });
    return doubanSubjectCollectionSchema.parse(resp);
  }
  //#endregion

  //#region Subject Detail
  async getSubjectDetail(subjectId: string | number) {
    const resp = await this.request({
      url: `/subject/${subjectId}`,
      cache: {
        key: `subject_detail:${subjectId}`,
        ttl: 1000 * SECONDS_PER_DAY,
      },
    });
    return doubanSubjectDetailSchema.parse(resp);
  }
  //#endregion

  //#region Subject Detail Desc
  async getSubjectDetailDesc(subjectId: string | number) {
    const resp = await this.request<{ html: string }>({
      url: `/subject/${subjectId}/desc`,
      cache: {
        key: `subject_detail_desc:${subjectId}`,
        ttl: 1000 * SECONDS_PER_DAY,
      },
    });
    const $ = cheerioLoad(resp.html);
    const info = Array.from($(".subject-desc table").find("tr")).map((el) => {
      const $el = $(el);
      const key = $el.find("td:first-child").text().trim();
      const value = $el.find("td:last-child").text().trim();
      return [key, value];
    });
    return Object.fromEntries(info);
  }
  //#endregion

  async getDoubanIdByImdbId(imdbId: string) {
    const resp = await this.request<{ id: string }>({
      url: `https://api.douban.com/v2/movie/imdb/${imdbId}`,
      method: "POST",
      data: {
        apikey: this.context.env.DOUBAN_API_KEY || process.env.DOUBAN_API_KEY,
      },
      cache: {
        key: `douban_id_by_imdb_id:${imdbId}`,
        ttl: 1000 * SECONDS_PER_DAY,
      },
    });
    const doubanId = z.coerce.number().parse(resp.id?.split("/")?.pop());
    try {
      this.context.executionCtx.waitUntil(
        this.db
          .insert(doubanMapping)
          .values({ imdbId, doubanId })
          .onConflictDoUpdate({
            target: doubanMapping.doubanId,
            set: { imdbId },
            setWhere: or(ne(doubanMapping.calibrated, 1), isNull(doubanMapping.calibrated)),
          }),
      );
    } catch (error) {}
    return doubanId;
  }

  async fetchDoubanIdMapping(doubanIds: number[]) {
    const rows = await this.db.select().from(doubanMapping).where(inArray(doubanMapping.doubanId, doubanIds));
    const mappingCache = new Map<number, Partial<DoubanIdMapping>>();
    const mappedIds = new Set<number>();
    for (const { doubanId, imdbId, tmdbId, traktId } of rows) {
      if (imdbId || tmdbId || traktId) {
        mappingCache.set(doubanId, { imdbId, tmdbId, traktId });
        mappedIds.add(doubanId);
      }
    }
    if (mappedIds.size > 0) {
      console.info("🔍 Found", mappedIds.size, "mapped ids in database");
    }
    const missingIds = doubanIds.filter((id) => !mappedIds.has(id));
    return { mappingCache, missingIds };
  }

  async persistDoubanIdMapping(mappings: (DoubanIdMapping | null)[]) {
    const data = mappings.filter(
      (item): item is DoubanIdMapping => !!item && !!(item.imdbId || item.tmdbId || item.traktId),
    );
    if (data.length === 0) return;
    console.log("🗄️ Updating douban id mapping", data);
    await this.db
      .insert(doubanMapping)
      .values(data)
      .onConflictDoUpdate({
        target: doubanMapping.doubanId,
        set: {
          imdbId: sql`COALESCE(${doubanMapping.imdbId}, excluded.imdb_id)`,
          tmdbId: sql`COALESCE(${doubanMapping.tmdbId}, excluded.tmdb_id)`,
          traktId: sql`COALESCE(${doubanMapping.traktId}, excluded.trakt_id)`,
        },
        setWhere: or(ne(doubanMapping.calibrated, 1), isNull(doubanMapping.calibrated)),
      });
  }

  private getTraktSearchField<T extends "ids" | "title" | "original_title">(data: SearchResultResponse, field: T) {
    if (data.type === "show") {
      return data.show?.[field];
    }
    if (data.type === "movie") {
      return data.movie?.[field];
    }
    return null;
  }

  private cleanTraktSearchTitle(title?: string) {
    if (!title) {
      return null;
    }
    // 支持匹配阿拉伯数字和中文数字的“第X季”或类如“（第二季）”的内容
    // 匹配形如 (第2季)、(第二季)、(第十二季) 等内容
    return title.replace(/\s*（?第?[0-9一二三四五六七八九十百零]+季）?\s*/g, "").trim();
  }

  private async findIdByTraktSearch(params: FindTmdbIdParams) {
    const { type, doubanId } = params;
    let { title } = params;
    if (!title && doubanId) {
      const detail = await this.getSubjectDetail(doubanId);
      title = detail.title;
    }
    if (!title) {
      return null;
    }
    const traktType = type === "tv" ? "show" : "movie";
    const resp = await this.request<SearchResultResponse[]>({
      baseURL: TraktBaseUrl.production,
      url: `/search/${traktType}`,
      params: { query: title },
      cache: { key: `trakt:search:${traktType}:${title}`, ttl: 1000 * SECONDS_PER_HOUR },
    });
    const data = z.array(searchResultResponseSchema).parse(resp);
    if (data.length === 0) {
      return null;
    }
    if (data.length === 1) {
      return this.getTraktSearchField(data[0], "ids");
    }
    const titleSet = new Set([title, this.cleanTraktSearchTitle(title)].filter(Boolean));
    const nameMatches = data.filter((result) => {
      const traktTitle = this.getTraktSearchField(result, "title") ?? "";
      const traktOriginalTitle = this.getTraktSearchField(result, "original_title") ?? "";
      return titleSet.has(traktTitle) || titleSet.has(traktOriginalTitle);
    });

    if (nameMatches.length === 1) {
      return this.getTraktSearchField(nameMatches[0], "ids");
    }
    if (nameMatches.length > 1) {
      console.warn(
        "🔍 Trakt search title matches multiple results",
        title,
        nameMatches.map((result) => this.getTraktSearchField(result, "title")),
      );
    }
    return null;
  }

  private async findIdByImdbId(imdbId: string) {
    const resp = await this.request({
      baseURL: TraktBaseUrl.production,
      url: `/search/imdb/${imdbId}`,
      cache: { key: `trakt:search:imdb:${imdbId}`, ttl: 1000 * SECONDS_PER_DAY },
    });
    const data = z.array(searchResultResponseSchema).parse(resp);
    if (data.length === 0) {
      return null;
    }
    if (data.length === 1) {
      return this.getTraktSearchField(data[0], "ids");
    }
    return null;
  }

  async findExternalId(params: FindTmdbIdParams) {
    const result: DoubanIdMapping = {
      doubanId: params.doubanId,
      imdbId: null,
      tmdbId: null,
      traktId: null,
      calibrated: 0,
    };

    const assignTraktIds = (
      ids?:
        | NonNullable<SearchMovieResultResponse["movie"]>["ids"]
        | NonNullable<SearchShowResultResponse["show"]>["ids"]
        | null,
    ) => {
      if (!ids) return;
      result.traktId = ids.trakt ?? null;
      result.tmdbId = ids.tmdb ?? null;
      result.imdbId = ids.imdb ?? null;
    };

    // 1. 尝试从豆瓣详情页获取 IMDb ID
    const detail = await this.getSubjectDetailDesc(params.doubanId).catch(() => null);
    if (detail?.IMDb) {
      result.imdbId = detail.IMDb;
      // 通过 IMDb ID 查找 Trakt/TMDB ID
      const traktIds = await this.findIdByImdbId(detail.IMDb).catch(() => null);
      assignTraktIds(traktIds);
    }

    // 2. 如果没有 IMDb ID，尝试通过 Trakt 搜索标题
    if (!result.imdbId) {
      const traktIds = await this.findIdByTraktSearch(params).catch(() => null);
      if (traktIds) {
        assignTraktIds(traktIds);
      }
    }
    return result;
  }
}

export const douban = new Douban();
