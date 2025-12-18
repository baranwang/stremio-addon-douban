import type { ManifestCatalog } from "@stremio-addon/sdk";
import pLimit from "p-limit";
import { api } from "./api";
import { COLLECTION_CONFIGS, DEFAULT_COLLECTION_IDS } from "./catalog-shared";
import type { Config } from "./config";

export * from "./catalog-shared";

export const getCatalogs = async (config: Config) => {
  const limit = pLimit(5);
  const catalogsPromises: Promise<ManifestCatalog>[] = [];

  const catalogIdsSet = new Set(config.catalogIds || DEFAULT_COLLECTION_IDS);
  const catalogMap = new Map(COLLECTION_CONFIGS.map((item) => [item.id, item]));

  if (config.dynamicCollections) {
    const categories = [
      { type: "movie", moduleName: "movie_selected_chart_collections", catalogType: "movie" },
      { type: "tv", moduleName: "tv_selected_chart_collections", catalogType: "series" },
    ] as const;

    await Promise.allSettled(
      categories.map(async ({ type, moduleName, catalogType }) => {
        try {
          const resp = await api.doubanAPI.getModules(type);
          const module = resp.modules.find((m) => m?.module_name === moduleName);

          for (const collection of module?.data.selected_collections ?? []) {
            if (!collection.is_merged_cover) {
              continue;
            }
            catalogMap.set(collection.id, {
              id: collection.id,
              name: collection.title,
              type: catalogType,
              hasGenre: false,
            });
            catalogIdsSet.add(collection.id);
          }
        } catch (error) {
          console.error(`Failed to fetch dynamic collections for ${type}:`, error);
        }
      }),
    );
  }

  for (const catalogId of catalogIdsSet) {
    const item = catalogMap.get(catalogId);
    if (!item) {
      continue;
    }
    catalogsPromises.push(
      limit(async () => {
        const result: ManifestCatalog = {
          ...item,
        };
        result.extra ||= [];
        result.extra.push({ name: "skip" });
        if (item.hasGenre) {
          const info = await api.doubanAPI.getSubjectCollectionCategory(catalogId).catch(() => null);
          const categoryItems = info?.items ?? [];
          if (categoryItems.length > 1) {
            result.extra.push({ name: "genre", options: categoryItems.map((item) => item.name), optionsLimit: 1 });
          }
        }
        return result;
      }),
    );
  }

  return Promise.all(catalogsPromises);
};
