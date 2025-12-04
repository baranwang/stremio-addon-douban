import {
  episodeResponseSchema,
  searchResultResponseSchema,
  showResponseSchema,
  Environment as TraktBaseUrl,
} from "@trakt/api";
import z from "zod";
import { SECONDS_PER_DAY } from "../constants";
import { BaseAPI } from "./base";

/** 修复 trakt api 中 searchResultResponseSchema 缺失 episode 类型 */
const searchResultResponseSchemaWithEpisode = z.union([
  searchResultResponseSchema,
  z.object({
    score: z.number().int(),
    type: z.literal("episode"),
    episode: episodeResponseSchema,
    show: showResponseSchema,
  }),
]);

export type SearchResultResponse = z.output<typeof searchResultResponseSchemaWithEpisode>;

export class TraktAPI extends BaseAPI {
  constructor() {
    super({ baseURL: TraktBaseUrl.production });
    this.axios.interceptors.request.use((config) => {
      config.headers.set("trakt-api-version", "2");
      config.headers.set("trakt-api-key", this.context.env.TRAKT_CLIENT_ID || process.env.TRAKT_CLIENT_ID);
      const userAgent = this.context.req.header("User-Agent");
      if (userAgent) {
        config.headers.set("User-Agent", userAgent);
      }
      return config;
    });
  }

  getSearchResultField<T extends "ids" | "title" | "original_title">(data: SearchResultResponse, field: T) {
    if (data.type === "show" || data.type === "episode") {
      return data.show?.[field];
    }
    if (data.type === "movie") {
      return data.movie?.[field];
    }
    return null;
  }

  async search(type: "movie" | "show" | "episode", query: string) {
    const resp = await this.request<SearchResultResponse[]>({
      url: `/search/${type}`,
      params: { query },
      cache: { key: `trakt:search:${type}:${query}`, ttl: 1000 * SECONDS_PER_DAY },
    });
    return z.array(searchResultResponseSchemaWithEpisode).parse(resp);
  }

  async searchByImdbId(imdbId: string) {
    const resp = await this.request<SearchResultResponse[]>({
      url: `/search/imdb/${imdbId}`,
      cache: { key: `trakt:search:imdb:${imdbId}`, ttl: 1000 * SECONDS_PER_DAY },
    });
    return z.array(searchResultResponseSchemaWithEpisode).parse(resp);
  }
}
