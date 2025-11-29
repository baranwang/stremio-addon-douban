import { LRUCache } from "lru-cache";
import z from "zod";
import { http } from "./http";
import { doubanSubjectCollectionSchema, doubanSubjectDetailSchema } from "./schema";

interface WithCacheParams<T extends z.ZodType> {
  max: number;
  ttl: number;
  zodSchema: T;
  fetchMethod: (key: string, signal: AbortSignal) => Promise<z.output<T> | undefined>;
}
const withCache = <T extends z.ZodObject>(params: WithCacheParams<T>) => {
  const { max, ttl, zodSchema, fetchMethod } = params;
  return new LRUCache<string, z.output<T>>({
    max,
    ttl,
    fetchMethod: async (key, _, { signal }) => {
      const resp = await fetchMethod(key, signal);
      const { success, data, error } = zodSchema.safeParse(resp);
      if (!success) {
        console.warn(z.prettifyError(error));
        return undefined;
      }
      return data;
    },
  });
};

export const doubanSubjectCollectionCache = withCache({
  max: 500,
  ttl: 1000 * 60 * 30,
  zodSchema: doubanSubjectCollectionSchema,
  fetchMethod: async (key, signal) => {
    const [id, skip] = key.split(":");
    const resp = await http.get(`https://m.douban.com/rexxar/api/v2/subject_collection/${id}/items`, {
      params: {
        start: skip ?? 0,
        count: 10,
        for_mobile: 1,
      },
      headers: {
        Referer: `https://m.douban.com/subject_collection/${id}`,
      },
      signal,
    });
    return resp.data;
  },
});

export const doubanSubjectDetailCache = withCache({
  max: 500,
  ttl: 1000 * 60 * 30,
  zodSchema: doubanSubjectDetailSchema,
  fetchMethod: async (key, signal) => {
    const resp = await http.get(`https://m.douban.com/rexxar/api/v2/subject/${key}`, {
      params: {
        for_mobile: 1,
      },
      headers: {
        Referer: `https://m.douban.com/movie/subject/${key}`,
      },
      signal,
    });
    return resp.data;
  },
});
