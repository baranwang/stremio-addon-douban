import type { Manifest } from "@stremio-addon/sdk";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import pkg from "../package.json" with { type: "json" };
import { app } from "./app";
import { catalogRouter, getCatalogs } from "./catalog";

app.use("*", cors());
app.use(logger((str, ...rest) => console.info(`[${new Date().toISOString()}]`, str, ...rest)));

app.get("/", (c) => {
  c.env;
  return c.redirect("/manifest.json");
});

app.get("/manifest.json", async (c) => {
  const catalogs = await getCatalogs();

  return c.json({
    id: "douban.addon",
    version: pkg.version,
    name: "Douban",
    description: "Douban addon for Stremio",
    logo: "https://img1.doubanio.com/f/frodo/144e6fb7d96701944e7dbb1a9bad51bdb1debe29/pics/app/logo.png",
    types: ["movie", "series"],
    resources: ["catalog"],
    catalogs,
  } satisfies Manifest);
});

app.route("/catalog", catalogRouter);

export default app;
