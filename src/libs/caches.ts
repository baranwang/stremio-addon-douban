import { LRUCache } from "lru-cache";
import z from "zod";
import { http } from "./http";
import { doubanSubjectCollectionSchema, doubanSubjectDetailSchema } from "./schema";

export const doubanSubjectCollectionCache = new LRUCache<string, z.output<typeof doubanSubjectCollectionSchema>>({
  max: 500,
  ttl: 1000 * 60 * 30,
  fetchMethod: async (key, _, { signal }) => {
    const [id, skip] = key.split(":");
    const resp = await http.get(`https://m.douban.com/rexxar/api/v2/subject_collection/${id}/items`, {
      params: {
        start: skip ?? 0,
        count: 1,
        for_mobile: 1,
      },
      headers: {
        Referer: `https://m.douban.com/subject_collection/${id}`,
      },
      signal,
    });
    const { success, data, error } = doubanSubjectCollectionSchema.safeParse(resp.data);
    if (!success) {
      console.warn(z.prettifyError(error));
      return undefined;
    }
    return data;
  },
});

export const doubanSubjectDetailCache = new LRUCache<string, z.output<typeof doubanSubjectDetailSchema>>({
  max: 500,
  ttl: 1000 * 60 * 30,
  fetchMethod: async (key, _, { signal }) => {
    const resp = await http.get(`https://m.douban.com/rexxar/api/v2/subject/${key}`, {
      params: {
        for_mobile: 1,
      },
      headers: {
        Referer: `https://m.douban.com/movie/subject/${key}`,
      },
      signal,
    });
    const { success, data, error } = doubanSubjectDetailSchema.safeParse(resp.data);
    if (!success) {
      console.warn(z.prettifyError(error));
      return undefined;
    }
    return data;
  },
});
