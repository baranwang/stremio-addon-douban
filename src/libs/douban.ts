import axios, { type AxiosInstance } from "axios";
import { load as cheerioLoad } from "cheerio";
import { inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Env } from "hono";
import { LRUCache } from "lru-cache";
import type { z } from "zod";
import { type DoubanIdMapping, doubanMapping } from "../db";
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from "./constants";
import { doubanSubjectCollectionSchema, doubanSubjectDetailSchema, tmdbSearchResultSchema } from "./schema";

interface FindTmdbIdParams {
  type: "movie" | "tv";
  doubanId: number;
  originalTitle?: string;
  year?: string;
}
export class Douban {
  static PAGE_SIZE = 10;

  private cloudflareBindings?: Env["Bindings"];

  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: "https://frodo.douban.com/api/v2",
      adapter: "fetch",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/99/page-frame.html",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Mac MacWechat/WMPF MacWechat/3.8.7(0x13080712) UnifiedPCMacWechat(0xf264101d) XWEB/16390",
      },
      params: {
        apiKey: this.cloudflareBindings?.DOUBAN_API_KEY || process.env.DOUBAN_API_KEY,
      },
    });
    this.http.interceptors.request.use((config) => {
      console.info("⬆️", config.method?.toUpperCase(), axios.getUri(config));
      return config;
    });
  }

  initialize(cloudflareBindings: Env["Bindings"]) {
    this.cloudflareBindings = cloudflareBindings;
  }

  private get db() {
    if (!this.cloudflareBindings?.stremio_addon_douban) {
      throw new Error("Database not initialized");
    }
    return drizzle(this.cloudflareBindings?.stremio_addon_douban);
  }

  //#region Subject Collection
  private getSubjectCollectionCache = new LRUCache<string, z.output<typeof doubanSubjectCollectionSchema>>({
    max: 500,
    ttl: 1000 * SECONDS_PER_HOUR * 2,
    fetchMethod: async (key, _, { signal }) => {
      const [id, skip] = key.split(":");
      const resp = await this.http.get(`/subject_collection/${id}/items`, {
        params: {
          start: skip,
          count: Douban.PAGE_SIZE,
        },
        signal,
      });
      return doubanSubjectCollectionSchema.parse(resp.data);
    },
  });
  getSubjectCollection(collectionId: string, skip: string | number = 0) {
    return this.getSubjectCollectionCache.fetch(`${collectionId}:${skip}`);
  }
  //#endregion

  //#region Subject Detail
  private getSubjectDetailCache = new LRUCache<string, z.output<typeof doubanSubjectDetailSchema>>({
    max: 500,
    ttl: 1000 * SECONDS_PER_DAY,
    fetchMethod: async (key, _, { signal }) => {
      const resp = await this.http.get(`/subject/${key}`, { signal });
      return doubanSubjectDetailSchema.parse(resp.data);
    },
  });
  getSubjectDetail(subjectId: string | number) {
    return this.getSubjectDetailCache.fetch(subjectId.toString());
  }
  //#endregion

  //#region Subject Detail Desc
  private getSubjectDetailDescCache = new LRUCache<string, Record<string, string>>({
    max: 500,
    ttl: 1000 * SECONDS_PER_DAY,
    fetchMethod: async (key, _, { signal }) => {
      const resp = await this.http.get<{ html: string }>(`/subject/${key}/desc`, { signal });
      const $ = cheerioLoad(resp.data.html);
      const info = $(".subject-desc table")
        .find("tr")
        .map((_, el) => {
          const $el = $(el);
          const key = $el.find("td:first-child").text().trim();
          const value = $el.find("td:last-child").text().trim();
          return [key, value];
        })
        .toArray() as unknown as [string, string][];
      return Object.fromEntries(info);
    },
  });
  getSubjectDetailDesc(subjectId: string | number) {
    return this.getSubjectDetailDescCache.fetch(subjectId.toString());
  }
  //#endregion

  async fetchDoubanIdMapping(doubanIds: number[]) {
    const rows = await this.db.select().from(doubanMapping).where(inArray(doubanMapping.doubanId, doubanIds));
    const mappingCache = new Map<number, Omit<DoubanIdMapping, "doubanId">>();
    const mappedIds = new Set<number>();
    for (const { doubanId, imdbId, tmdbId } of rows) {
      if (imdbId || tmdbId) {
        mappingCache.set(doubanId, { imdbId, tmdbId });
        mappedIds.add(doubanId);
      }
    }
    const missingIds = doubanIds.filter((id) => !mappedIds.has(id));
    return { mappingCache, missingIds };
  }
  async persistDoubanIdMapping(mappings: DoubanIdMapping[]) {
    if (mappings.length === 0) return;
    await this.db
      .insert(doubanMapping)
      .values(mappings)
      .onConflictDoUpdate({
        target: doubanMapping.doubanId,
        set: { imdbId: sql`excluded.imdb_id`, tmdbId: sql`excluded.tmdb_id` },
      });
  }

  async findTmdbId(parmas: FindTmdbIdParams) {
    const { type, doubanId, originalTitle, year: defaultYear } = parmas;
    let query = originalTitle;
    let year = defaultYear;
    if (!query) {
      const detail = await this.getSubjectDetail(doubanId);
      if (detail) {
        query = detail.original_title || detail.title;
        year ||= detail.year ?? undefined;
      }
    }
    const resp = await this.http.get(`https://api.themoviedb.org/3/search/${type}`, {
      params: {
        query,
        year,
        language: "zh-CN",
      },
    });
    const { results } = tmdbSearchResultSchema.parse(resp.data);

    if (results.length === 0) {
      return null;
    }
    // 只有一个结果，直接返回
    if (results.length === 1) {
      return results[0].id;
    }

    const nameMatches = results.filter((result) => result.title === query || result.original_title === query);
    if (nameMatches.length === 1) {
      return nameMatches[0].id;
    }

    return null;
  }

  async findExternalId(parmas: FindTmdbIdParams) {
    const result: DoubanIdMapping = {
      doubanId: parmas.doubanId,
      imdbId: null,
      tmdbId: null,
    };
    // 二者有其一即可，优先使用 IMDb ID
    try {
      const detail = await this.getSubjectDetailDesc(parmas.doubanId);
      if (detail?.IMDb) {
        result.imdbId = detail.IMDb;
      }
    } catch (error) {}
    if (!result.imdbId) {
      try {
        const tmdbId = await this.findTmdbId(parmas);
        if (tmdbId) {
          result.tmdbId = tmdbId;
        }
      } catch (error) {}
    }
    return result;
  }
}

export const douban = new Douban();
