import axios from "axios";
import { load as cheerioLoad } from "cheerio";
import { isNull, ne, or } from "drizzle-orm";
import { z } from "zod/v4";
import { doubanMapping } from "@/db";
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from "../../constants";
import { BaseAPI } from "../base";
import { doubanSubjectCollectionSchema, doubanSubjectDetailSchema } from "./schema";

export class DoubanAPI extends BaseAPI {
  static PAGE_SIZE = 10;

  constructor() {
    super({
      baseURL: "https://frodo.douban.com/api/v2",
      headers: {
        Referer: "https://servicewechat.com/wx2f9b06c1de1ccfca/99/page-frame.html",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Mac MacWechat/WMPF MacWechat/3.8.7(0x13080712) UnifiedPCMacWechat(0xf264101d) XWEB/16390",
      },
    });
    this.axios.interceptors.request.use(async (config) => {
      const finalUri = axios.getUri(config);
      if (finalUri.startsWith("https://frodo.douban.com/")) {
        config.params ||= {};
        config.params.apiKey = this.env.DOUBAN_API_KEY || process.env.DOUBAN_API_KEY;
      }
      return config;
    });
  }

  async getSubjectCollection(collectionId: string, skip: string | number = 0) {
    const resp = await this.request({
      url: `/subject_collection/${collectionId}/items`,
      params: {
        start: skip,
        count: DoubanAPI.PAGE_SIZE,
      },
      cache: {
        key: `subject_collection:${collectionId}:${skip}`,
        ttl: 1000 * SECONDS_PER_HOUR * 2,
      },
    });
    return doubanSubjectCollectionSchema.parse(resp);
  }

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
    return Object.fromEntries(info) as Record<string, string>;
  }

  async getIdByImdbId(imdbId: string) {
    const resp = await this.request<{ id: string }>({
      url: `https://api.douban.com/v2/movie/imdb/${imdbId}`,
      method: "POST",
      data: {
        apikey: this.env.DOUBAN_API_KEY || process.env.DOUBAN_API_KEY,
      },
      cache: {
        key: `douban_id_by_imdb_id:${imdbId}`,
        ttl: 1000 * SECONDS_PER_DAY,
      },
    });
    const doubanId = z.coerce.number().parse(resp.id?.split("/")?.pop());
    try {
      this.context.waitUntil(
        this.db
          .insert(doubanMapping)
          .values({ imdbId, doubanId })
          .onConflictDoUpdate({
            target: doubanMapping.doubanId,
            set: { imdbId },
            setWhere: or(ne(doubanMapping.calibrated, true), isNull(doubanMapping.calibrated)),
          }),
      );
    } catch (error) {}
    return doubanId;
  }
}
