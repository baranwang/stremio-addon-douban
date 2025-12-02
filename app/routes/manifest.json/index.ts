import type { Manifest } from "@stremio-addon/sdk";
import { createRoute } from "honox/factory";
import pkg from "@/../package.json" with { type: "json" };
import { getCatalogs } from "../catalog";
import { idPrefixes } from "../meta";

export default createRoute(async (c) => {
  const catalogs = await getCatalogs(c);

  return c.json({
    id: pkg.name,
    version: pkg.version,
    name: pkg.displayName,
    description: pkg.description,
    logo: "https://img1.doubanio.com/f/frodo/144e6fb7d96701944e7dbb1a9bad51bdb1debe29/pics/app/logo.png",
    types: ["movie", "series"],
    resources: ["catalog", "meta"],
    catalogs,
    idPrefixes,
  } satisfies Manifest);
});
