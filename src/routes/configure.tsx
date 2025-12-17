import { reactRenderer } from "@hono/react-renderer";
import { type Env, Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { Github, Heart } from "lucide-react";
import { Link, Script, ViteClient } from "vite-ssr-components/react";
import pkg from "@/../package.json" with { type: "json" };
import { Configure, type ConfigureProps } from "@/components/configure";
import { Button } from "@/components/ui/button";
import { ALL_COLLECTION_IDS, DEFAULT_COLLECTION_IDS } from "@/libs/catalog";
import { decodeConfig, encodeConfig } from "@/libs/config";

export const configureRoute = new Hono<Env>();

configureRoute.get(
  "*",
  reactRenderer(({ c, children }) => {
    const userAgent = c.req.header("User-Agent");
    const isSafari = userAgent?.includes("Safari") && !userAgent?.includes("Chrome");
    return (
      <html lang="zh" className={isSafari ? "safari" : ""}>
        <head>
          <ViteClient />
          <Link rel="stylesheet" href="/src/style.css" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
          />
        </head>
        <body>{children}</body>
      </html>
    );
  }),
);

configureRoute.post("/", async (c) => {
  const formData = await c.req.formData();
  const catalogIds = formData.get("catalogIds")?.toString().split(",").filter(Boolean) ?? [];
  const imageProxy = formData.get("imageProxy")?.toString() ?? "none";
  const dynamicCollections = formData.get("dynamicCollections")?.toString() === "on";
  const config = encodeConfig({ catalogIds, imageProxy, dynamicCollections });
  setCookie(c, "config", config);
  return c.redirect(`/${config}/configure`);
});

configureRoute.get("/", (c) => {
  const defaultConfig = getCookie(c, "config") ?? c.req.param("config");
  const rawConfig = decodeConfig(defaultConfig ?? "");
  const initialSelectedIds = rawConfig.catalogIds || DEFAULT_COLLECTION_IDS;

  const config = {
    ...rawConfig,
    catalogIds: ALL_COLLECTION_IDS.filter((id) => initialSelectedIds.includes(id)),
  };

  const configId = encodeConfig(config);
  const { origin } = new URL(c.req.url);

  const configureProps: ConfigureProps = {
    config,
    manifestUrl: `${origin}/${configId}/manifest.json`,
  };

  return c.render(
    <>
      <Script src="/src/client/configure.tsx" />
      <div className="container mx-auto flex h-dvh max-w-lg flex-col">
        <header className="shrink-0 px-4 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-balance font-bold text-xl tracking-tight">{pkg.description}</h1>
              <p className="text-muted-foreground text-sm">选择要显示的目录，生成你的专属配置</p>
            </div>
            <div className="flex items-center max-sm:flex-col max-sm:items-start">
              <Button variant="ghost" size="sm" asChild>
                <a href="https://github.com/baranwang/stremio-addon-douban" target="_blank" rel="noopener noreferrer">
                  <Github />
                  <span>GitHub</span>
                </a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="https://afdian.com/a/baran" target="_blank" rel="noopener noreferrer">
                  <Heart />
                  <span>捐赠</span>
                </a>
              </Button>
            </div>
          </div>
        </header>

        <script
          id="__INITIAL_DATA__"
          type="application/json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: initialize data
          dangerouslySetInnerHTML={{ __html: JSON.stringify(configureProps) }}
        />
        <div id="configure" className="flex min-h-0 flex-1 flex-col">
          <Configure {...configureProps} />
        </div>
      </div>
    </>,
  );
});
