import axios, { type AxiosInstance } from "axios";
import { load as cheerioLoad } from "cheerio";
import type { Env } from "hono";
import { LRUCache } from "lru-cache";
import type { z } from "zod";
import { doubanSubjectCollectionSchema, doubanSubjectDetailSchema } from "./schema";

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

  //#region Subject Collection
  private getSubjectCollectionCache = new LRUCache<string, z.output<typeof doubanSubjectCollectionSchema>>({
    max: 500,
    ttl: 1000 * 60 * 60 * 2,
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
    ttl: 1000 * 60 * 60 * 24,
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
    ttl: 1000 * 60 * 60 * 24,
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
}

export const douban = new Douban();
