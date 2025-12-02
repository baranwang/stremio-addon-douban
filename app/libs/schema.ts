import { z } from "zod/v4";

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
    pic: z
      .object({
        large: z.string().nullish(),
        normal: z.string().nullish(),
      })
      .nullish(),
    photos: z.array(z.string()).nullish(),
    description: z.string().nullish(),
    comment: z.string().nullish(),
  })
  .transform((v) => ({
    ...v,
    cover: v.cover?.url ?? v.cover_url ?? v.pic?.large ?? v.pic?.normal,
    year: v.year ?? v.card_subtitle?.split("/")?.[0].trim(),
    description: v.description || v.comment,
  }));

export const doubanSubjectCollectionSchema = z.object({
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
  id: z.coerce.number(),
  type: z.enum(["movie", "tv"]),
  title: z.string(),
  original_title: z.string().nullish(),
  intro: z.string().nullish(),
  cover_url: z.string().nullish(),
  year: z.string().nullish(),
  pic: z
    .object({
      large: z.string().nullish(),
      normal: z.string().nullish(),
    })
    .nullish(),
  directors: z
    .array(
      z.object({
        name: z.string(),
      }),
    )
    .nullish(),
  actors: z
    .array(
      z.object({
        name: z.string(),
      }),
    )
    .nullish(),
  genres: z.array(z.string()).nullish(),
  countries: z.array(z.string()).nullish(),
  honor_infos: z
    .array(
      z.object({
        title: z.string(),
      }),
    )
    .nullish(),
  languages: z.array(z.string()).nullish(),
  pubdate: z.array(z.string()).nullish(),
});

export const tmdbSearchResultSchema = z.object({
  results: z.array(
    z.union([
      z.object({
        id: z.coerce.number(),
        title: z.string(),
        original_title: z.string().nullish(),
        release_date: z.string().nullish(),
      }),
      z
        .object({
          id: z.coerce.number(),
          name: z.string(),
          original_name: z.string().nullish(),
          first_air_date: z.string().nullish(),
        })
        .transform((v) => ({
          id: v.id,
          title: v.name,
          original_title: v.original_name,
          release_date: v.first_air_date,
        })),
    ]),
  ),
  total_results: z.number().nullish(),
});
