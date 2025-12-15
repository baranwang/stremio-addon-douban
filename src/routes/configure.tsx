import { type Env, Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { Github, Heart } from "lucide-react";
import { Link, Script, ViteClient } from "vite-ssr-components/react";
import pkg from "@/../package.json" with { type: "json" };
import { Configure, type ConfigureProps } from "@/components/configure";
import { Button } from "@/components/ui/button";
import { decodeConfig, encodeConfig } from "@/libs/config";
import { ALL_COLLECTION_IDS, DEFAULT_COLLECTION_IDS } from "@/libs/constants";

export const configureRoute = new Hono<Env>();

configureRoute.use("*", async (c, next) => {
  c.setRenderer((children) => {
    const userAgent = c.req.header("User-Agent");
    const isSafari = userAgent?.includes("Safari") && !userAgent?.includes("Chrome");
    return c.html(
      (
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
      ) as unknown as string,
    );
  });
  await next();
});

configureRoute.post("/", async (c) => {
  const formData = await c.req.formData();
  const catalogIds = formData.get("catalogIds")?.toString().split(",").filter(Boolean) ?? [];
  const config = encodeConfig({ catalogIds });
  setCookie(c, "config", config);
  return c.redirect(`/${config}/configure`);
});

configureRoute.get("/", (c) => {
  const defaultConfig = c.req.param("config") ?? getCookie(c, "config");
  const config = decodeConfig(defaultConfig ?? "");
  const initialSelectedIds = config.catalogIds || DEFAULT_COLLECTION_IDS;

  const manifestUrl = new URL(c.req.url);
  manifestUrl.search = "";
  manifestUrl.hash = "";
  const configId = encodeConfig({ catalogIds: ALL_COLLECTION_IDS.filter((id) => initialSelectedIds.includes(id)) });
  manifestUrl.pathname = `/${configId}/manifest.json`;

  const configureProps: ConfigureProps = {
    initialSelectedIds,
    manifestUrl: manifestUrl.toString(),
  };

  return c.render(
    (
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
            dangerouslySetInnerHTML={{ __html: JSON.stringify(configureProps) }}
          />
          <div id="configure" className="flex min-h-0 flex-1 flex-col">
            <Configure {...configureProps} />
          </div>
        </div>
      </>
    ) as unknown as string,
  );
});
