import { BaseAPI } from "../base";
import { tmdbSearchResultSchema } from "./schema";

export class TmdbAPI extends BaseAPI {
  constructor() {
    super({ baseURL: "https://api.themoviedb.org/3" });
    this.axios.interceptors.request.use((config) => {
      config.headers.set("Authorization", `Bearer ${this.env.TMDB_API_KEY || process.env.TMDB_API_KEY}`);
      return config;
    });
  }

  async search(type: "movie" | "tv", params: { query: string; year?: string }) {
    const resp = await this.request({
      url: `/search/${type}`,
      params,
    });
    return tmdbSearchResultSchema.parse(resp);
  }
}
