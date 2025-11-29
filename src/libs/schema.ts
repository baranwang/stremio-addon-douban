import { z } from "zod";

const doubanSubjectCollectionItemSchema = z
  .object({
    id: z.coerce.number(),
    type: z.enum(["movie", "tv"]),
    title: z.string(),
    original_title: z.string().nullish(),
    year: z.string().nullish(),
    card_subtitle: z.string().nullish(),
    cover_url: z.string().nullish(),
    cover: z
      .object({
        url: z.string(),
      })
      .nullish(),
  })
  .transform((v) => ({
    ...v,
    cover: v.cover?.url ?? v.cover_url,
    year: v.year ?? v.card_subtitle?.split("/")?.[0].trim(),
  }));

export type DoubanSubjectCollectionItem = z.output<typeof doubanSubjectCollectionItemSchema>;

export const doubanSubjectCollectionSchema = z.object({
  subject_collection: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullish(),
  subject_collection_items: z
    .array(
      z.unknown().transform((v) => {
        const result = doubanSubjectCollectionItemSchema.safeParse(v);
        if (result.success) {
          return result.data;
        }
        console.warn(z.prettifyError(result.error));
        return null;
      }),
    )
    .transform((v) => v.filter((v) => v !== null)),
  total: z.number(),
});

export const doubanSubjectDetailSchema = z.object({
  title: z.string(),
  original_title: z.string().nullish(),
  intro: z.string().nullish(),
  cover_url: z.string().nullish(),
});

const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";

const tmdbImageSchema = z
  .string()
  .nullish()
  .transform((v) => (v ? `${TMDB_IMAGE_BASE_URL}${v}` : undefined));

export const tmdbSearchResultItemSchema = z.intersection(
  z.object({
    id: z.coerce.number(),
    backdrop_path: tmdbImageSchema,
    poster_path: tmdbImageSchema,
    overview: z.string().optional(),
  }),
  z
    .union([
      z.object({
        title: z.string().optional(),
        original_title: z.string().optional(),
      }),
      z.object({
        name: z.string().optional(),
        original_name: z.string().optional(),
      }),
    ])
    .transform((v) => {
      return {
        finalName: (v as { title?: string }).title || (v as { name?: string }).name || "",
        finalOriginalName:
          (v as { original_title?: string }).original_title || (v as { original_name?: string }).original_name || "",
      };
    }),
);

export const tmdbSearchResultSchema = z.object({
  results: z.array(tmdbSearchResultItemSchema),
  total_results: z.number(),
});

export const tmdbDetailSchema = z.intersection(
  tmdbSearchResultItemSchema,
  z.object({
    genres: z.array(
      z.object({
        id: z.coerce.number(),
        name: z.string(),
      }),
    ),
    release_date: z.string().optional(),
  }),
);
