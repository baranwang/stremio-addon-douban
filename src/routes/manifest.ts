import type { Manifest } from "@stremio-addon/sdk";
import { type Env, Hono } from "hono";
import pkg from "@/../package.json" with { type: "json" };
import { getCatalogs } from "@/libs/catalog";
import { type Config, encodeConfig, getConfig } from "@/libs/config";
import { idPrefixes } from "./meta";

export const manifestRoute = new Hono<Env>();

manifestRoute.get("/", async (c) => {
  const configId = c.req.param("config");
  if (!configId) {
    const encodedConfig = encodeConfig();
    return c.redirect(`/${encodedConfig}/manifest.json`);
  }

  const config = await getConfig(c.env, configId);

  const catalogs = await getCatalogs(config);
  return c.json({
    id: `${pkg.name}.${configId}`,
    version: pkg.version,
    name: pkg.displayName,
    description: pkg.description,
    logo: "https://img1.doubanio.com/f/frodo/144e6fb7d96701944e7dbb1a9bad51bdb1debe29/pics/app/logo.png",
    types: ["movie", "series"],
    resources: ["catalog", "meta"],
    catalogs,
    idPrefixes,
    behaviorHints: {
      configurable: true,
    },
    currentConfig: config,
  } satisfies Manifest & { currentConfig: Config });
});
