import type { Manifest } from "@stremio-addon/sdk";
import { type Env, Hono } from "hono";
import pkg from "@/../package.json" with { type: "json" };
import { getCatalogs } from "@/libs/catalog";
import { type Config, decodeConfig, encodeConfig } from "@/libs/config";

export const manifestRoute = new Hono<Env>();

manifestRoute.get("/", async (c) => {
  const configId = c.req.param("config");
  if (!configId) {
    const encodedConfig = encodeConfig();
    return c.redirect(`/${encodedConfig}/manifest.json`);
  }
  const config = decodeConfig(configId ?? "");
  if (!config) {
    return c.notFound();
  }
  const catalogs = await getCatalogs(config.catalogIds);
  return c.json({
    id: `${pkg.name}.${configId}`,
    version: pkg.version,
    name: pkg.displayName,
    description: pkg.description,
    logo: "https://img1.doubanio.com/f/frodo/144e6fb7d96701944e7dbb1a9bad51bdb1debe29/pics/app/logo.png",
    types: ["movie", "series"],
    resources: ["catalog"],
    catalogs,
    behaviorHints: {
      configurable: true,
    },
    currentConfig: config,
  } satisfies Manifest & { currentConfig: Config });
});
