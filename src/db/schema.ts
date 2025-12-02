import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const doubanMapping = sqliteTable("douban_mapping", {
  doubanId: int("douban_id").notNull().primaryKey(),
  tmdbId: int("tmdb_id"),
  imdbId: text("imdb_id"),
  traktId: int("trakt_id"),
  calibrated: int("calibrated").default(0),
});

export type DoubanIdMapping = typeof doubanMapping.$inferSelect;
