import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";

export const doubanMapping = sqliteTable("douban_mapping", {
  doubanId: int("douban_id").notNull().primaryKey(),
  tmdbId: int("tmdb_id"),
  imdbId: text("imdb_id"),
  traktId: int("trakt_id"),
  calibrated: int("calibrated", { mode: "boolean" }).default(false),

  createdAt: int("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
  updatedAt: int("updated_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

export const doubanMappingInsertSchema = createInsertSchema(doubanMapping);

export type DoubanIdMapping = z.output<typeof doubanMappingInsertSchema>;
