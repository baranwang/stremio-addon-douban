import { z } from "zod/v4";

const tmdbImageSchema = z.string().transform((v) => (v ? `https://image.tmdb.org/t/p/original${v}` : null));

const tmdbSearchResultItemBaseSchema = z.object({
  id: z.int(),
  backdrop_path: tmdbImageSchema,
  poster_path: tmdbImageSchema,
});

export const tmdbSearchResultItemSchema = z
  .union([
    z.object({
      ...tmdbSearchResultItemBaseSchema.shape,
      title: z.string().nullish(),
      original_title: z.string().nullish(),
    }),
    z.object({
      ...tmdbSearchResultItemBaseSchema.shape,
      name: z.string().nullish(),
      original_name: z.string().nullish(),
    }),
  ])
  .transform((v) => ({
    ...v,
    title: (v as { title?: string }).title ?? (v as { name?: string }).name,
    original_title:
      (v as { original_title?: string }).original_title ?? (v as { original_name?: string }).original_name,
  }));

export const tmdbSearchResultSchema = z.object({
  results: z.array(tmdbSearchResultItemSchema),
  total_results: z.number().nullish(),
});
