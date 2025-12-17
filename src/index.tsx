import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { scheduled } from "./cron";
import { contextStorage, rateLimit } from "./libs/middleware";
import { catalogRoute } from "./routes/catalog";
import { configureRoute } from "./routes/configure";
import { dashRoute } from "./routes/dash";
import { manifestRoute } from "./routes/manifest";

const app = new Hono();

app.use(logger());
app.use(cors());
app.use(rateLimit);
app.use(contextStorage);

app.get("/", (c) => c.redirect("/configure"));

app.route("/manifest.json", manifestRoute);
app.route("/:config/manifest.json", manifestRoute);
app.route("/configure", configureRoute);
app.route("/:config/configure", configureRoute);
app.route("/catalog", catalogRoute);
app.route("/:config/catalog", catalogRoute);
app.route("/dash", dashRoute);

export default {
  fetch: app.fetch,
  scheduled,
};
