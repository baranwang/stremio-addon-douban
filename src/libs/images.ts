import { sortBy } from "es-toolkit";
import { Liquid } from "liquidjs";
import type { DoubanSubjectCollectionItem } from "./api";
import { FanartAPI } from "./api/fanart";
import { TmdbAPI } from "./api/tmdb";
import { TMDB_IMAGE_LANGUAGE } from "./api/tmdb/constants";
import type { ImageProvider } from "./config";

type DoubanInfo = Pick<DoubanSubjectCollectionItem, "cover" | "photos" | "type">;

export interface ImageUrls {
  poster: string | undefined;
  background: string | undefined;
  logo: string | undefined;
}

interface GenerateOptions {
  doubanInfo: DoubanInfo;
  tmdbId?: number | null;
  imdbId?: string | null;
}

interface ConstructorOptions {
  origin: string;
  userId?: string;
}

export class ImageUrlGenerator {
  private fanartAPI?: FanartAPI;
  private tmdbAPI?: TmdbAPI;
  private liquid = new Liquid();

  constructor(
    private providers: ImageProvider[],
    private options: ConstructorOptions,
  ) {}

  async generate(options: GenerateOptions): Promise<ImageUrls> {
    const result: ImageUrls = {
      poster: undefined,
      background: undefined,
      logo: undefined,
    };

    for (const provider of this.providers) {
      const urls = await this.getUrlsForProvider(provider, options);
      this.mergeUrls(result, urls);
      if (Object.values(result).every(Boolean)) break;
    }

    return result;
  }

  private async getUrlsForProvider(provider: ImageProvider, options: GenerateOptions): Promise<ImageUrls | null> {
    const { doubanInfo, tmdbId, imdbId } = options;

    switch (provider.provider) {
      case "douban":
        return this.getDoubanUrls(doubanInfo, provider.extra);

      case "fanart": {
        const id = tmdbId?.toString() ?? imdbId;
        if (!id) return null;
        return this.getFanartUrls(id, doubanInfo.type, provider.extra);
      }

      case "tmdb":
        if (!tmdbId) return null;
        return this.getTmdbUrls(tmdbId, doubanInfo.type, provider.extra);

      default:
        return null;
    }
  }

  private mergeUrls(target: ImageUrls, source?: ImageUrls | null): void {
    if (!source) return;
    target.poster ||= source.poster;
    target.background ||= source.background;
    target.logo ||= source.logo;
  }

  // Douban
  private getDoubanUrls(info: DoubanInfo, extra: ImageProvider<"douban">["extra"]): ImageUrls {
    return {
      poster: this.applyProxy(info.cover, extra.proxyTemplate),
      background: this.applyProxy(info.photos?.[0], extra.proxyTemplate),
      logo: undefined,
    };
  }

  private applyProxy(
    url: string | null | undefined,
    proxyTemplate: ImageProvider<"douban">["extra"]["proxyTemplate"],
  ): string | undefined {
    if (!url) return undefined;
    if (proxyTemplate) {
      return this.liquid.parseAndRenderSync(proxyTemplate, {
        url,
        userId: this.options.userId,
      });
    }
    return url;
  }

  // Fanart
  private async getFanartUrls(
    id: string,
    type: "movie" | "tv",
    extra: ImageProvider<"fanart">["extra"],
  ): Promise<ImageUrls | null> {
    this.fanartAPI ??= new FanartAPI(extra.apiKey);
    return this.fanartAPI.getSubjectImages(type, id);
  }

  // TMDB
  private async getTmdbUrls(
    tmdbId: number,
    type: "movie" | "tv",
    extra: ImageProvider<"tmdb">["extra"],
  ): Promise<ImageUrls | null> {
    this.tmdbAPI ??= new TmdbAPI(extra.apiKey);
    try {
      const imageLanguages = extra.imageLanguages ?? TMDB_IMAGE_LANGUAGE;
      const images = await this.tmdbAPI.getSubjectImages(type, tmdbId, imageLanguages);
      if (!images) return null;

      // 根据语言优先级排序图片
      const sortImages = <T extends { iso_639_1?: string | null; vote_average?: number; vote_count?: number }>(
        arr: T[],
      ): T[] => {
        return sortBy(arr, [
          (item) => {
            const lang = item.iso_639_1 ?? "null";
            let index = imageLanguages.indexOf(lang);
            if (index === -1) {
              // 尝试前缀匹配（如 zh-CN 匹配 zh）
              const prefix = lang.split("-")[0];
              index = imageLanguages.findIndex((l) => l === prefix || l.startsWith(`${prefix}-`));
            }
            return index === -1 ? Infinity : index;
          },
          (item) => -(item.vote_average ?? 0),
          (item) => -(item.vote_count ?? 0),
        ]);
      };

      const sortedPosters = sortImages(images.posters);
      const sortedBackdrops = sortImages(images.backdrops);
      const sortedLogos = sortImages(images.logos);

      return {
        poster: sortedPosters[0]?.file_path || undefined,
        background: sortedBackdrops[0]?.file_path || undefined,
        logo: sortedLogos[0]?.file_path || undefined,
      };
    } catch (error) {
      console.error(error);
      return null;
    }
  }
}
