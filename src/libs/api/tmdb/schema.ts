import { z } from "zod/v4";

const tmdbImageSchema = z.string().transform((v) => (v ? `https://image.tmdb.org/t/p/original${v}` : null));

const tmdbSearchResultItemBaseSchema = z.object({
  id: z.int(),
  backdrop_path: tmdbImageSchema.nullish(),
  poster_path: tmdbImageSchema.nullish(),
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

export const tmdbFindResultSchema = z.object({
  movie_results: z.array(tmdbSearchResultItemSchema).catch([]),
  tv_results: z.array(tmdbSearchResultItemSchema).catch([]),
  tv_episode_results: z.array(tmdbSearchResultItemSchema).catch([]),
});

const tmdbImageDataSchema = z.object({
  file_path: tmdbImageSchema,
  vote_average: z.number(),
  vote_count: z.number(),
});

export const tmdbSubjectImagesSchema = z.object({
  backdrops: z.array(tmdbImageDataSchema),
  posters: z.array(tmdbImageDataSchema),
  logos: z.array(tmdbImageDataSchema),
});

const tmdbGenreSchema = z.object({
  id: z.number().int().optional(),
  name: z.string(),
});

const tmdbMovieDetailSchema = z.object({
  id: z.number().int(),
  title: z.string().nullish(),
  original_title: z.string().nullish(),
  overview: z.string().nullish(),
  genres: z.array(tmdbGenreSchema).nullish(),
  release_date: z.string().nullish(),
});

const tmdbTvDetailSchema = z.object({
  id: z.number().int(),
  name: z.string().nullish(),
  original_name: z.string().nullish(),
  overview: z.string().nullish(),
  genres: z.array(tmdbGenreSchema).nullish(),
  first_air_date: z.string().nullish(),
});

export const tmdbSubjectDetailSchema = z.union([tmdbMovieDetailSchema, tmdbTvDetailSchema]).transform((value) => ({
  id: value.id,
  title: "title" in value ? value.title : value.name,
  original_title: "original_title" in value ? value.original_title : value.original_name,
  overview: value.overview,
  genres: value.genres ?? [],
  release_date: "release_date" in value ? value.release_date : value.first_air_date,
}));
