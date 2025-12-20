import { reactRenderer } from "@hono/react-renderer";
import { zValidator } from "@hono/zod-validator";
import { type Env, Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { Github, Heart } from "lucide-react";
import { Link, Script, ViteClient } from "vite-ssr-components/react";
import pkg from "@/../package.json" with { type: "json" };
import { Configure, type ConfigureProps } from "@/components/configure";
import { Button } from "@/components/ui/button";
import { ALL_COLLECTION_IDS, DEFAULT_COLLECTION_IDS } from "@/libs/catalog";
import { configSchema, decodeConfig, encodeConfig, getConfig, isUserId } from "@/libs/config";
import { saveUserConfig } from "@/libs/session";

export const configureRoute = new Hono<Env>().put("/", zValidator("json", configSchema), async (c) => {
  const config = c.req.valid("json");
  const user = c.get("user");
  if (!user) {
    return c.json({ success: false, message: "请登录" });
  }
  if (!user.hasStarred) {
    return c.json({ success: false, message: "请星标本项目" });
  }

  await saveUserConfig(c, user.id, config);
  return c.json({ success: true });
});

export type ConfigureRoute = typeof configureRoute;

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

// POST 处理配置保存
configureRoute.post("/", async (c) => {
  const formData = await c.req.formData();
  const catalogIds = formData.get("catalogIds")?.toString().split(",").filter(Boolean) ?? [];
  const imageProxy = formData.get("imageProxy")?.toString() ?? "none";
  const dynamicCollections = formData.get("dynamicCollections")?.toString() === "on";

  const user = c.get("user");

  // 如果用户已登录且已 Star，保存到数据库
  if (user?.hasStarred) {
    await saveUserConfig(c, user.id, { catalogIds, imageProxy, dynamicCollections });
    return c.redirect(`/${user.id}/configure`);
  }

  // 未登录或未 Star 用户使用传统方式
  const config = encodeConfig({ catalogIds, imageProxy, dynamicCollections });
  setCookie(c, "config", config);
  return c.redirect(`/${config}/configure`);
});

// GET 显示配置页面
configureRoute.get("/", async (c) => {
  const user = c.get("user");
  const configId = c.req.param("config");
  const { origin } = new URL(c.req.url);

  let manifestUrl: string;
  let configSource: string | undefined;

  // 确定配置来源和 manifest URL
  if (user?.hasStarred) {
    // 已登录且已 Star 用户
    configSource = user.id;
    manifestUrl = `${origin}/${user.id}/manifest.json`;
  } else if (configId && isUserId(configId)) {
    // URL 中是 userId
    configSource = configId;
    manifestUrl = `${origin}/${configId}/manifest.json`;
  } else {
    // 传统配置模式
    const defaultConfig = getCookie(c, "config") ?? configId;
    const rawConfig = decodeConfig(defaultConfig ?? "");
    const encodedConfig = encodeConfig(rawConfig);
    manifestUrl = `${origin}/${encodedConfig}/manifest.json`;
  }

  // 使用统一的 getConfig 获取配置
  const rawConfig = await getConfig(c.env, configSource);

  const initialSelectedIds = rawConfig.catalogIds || DEFAULT_COLLECTION_IDS;
  const config = {
    ...rawConfig,
    catalogIds: ALL_COLLECTION_IDS.filter((id) => initialSelectedIds.includes(id)),
  };

  const configureProps: ConfigureProps = {
    config,
    manifestUrl,
    user: user ?? undefined,
  };

  return c.render(
    <>
      <Script src="/src/client/configure.tsx" />
      <div className="flex h-dvh flex-col">
        <header className="page-container shrink-0 px-4 pt-6 pb-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-balance font-bold text-xl tracking-tight">{pkg.description}</h1>
              <p className="text-muted-foreground text-sm">选择要显示的目录，生成你的专属配置</p>
            </div>
            <div className="flex items-center gap-1">
              {user ? (
                <div id="user-menu" />
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <a href="/auth/github">
                    <Github className="size-4" />
                    <span>登录</span>
                  </a>
                </Button>
              )}
            </div>
          </div>
          {user && !user.hasStarred && <div id="star-banner" />}
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

        <footer className="shrink-0 px-4 py-2">
          <div className="flex items-center justify-center gap-4 text-muted-foreground text-xs">
            <a
              href="https://github.com/baranwang/stremio-addon-douban"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <Github className="size-3" />
              <span>GitHub</span>
            </a>
            <a
              href="https://afdian.com/a/baran"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <Heart className="size-3" />
              <span>捐赠</span>
            </a>
          </div>

          <div className="h-safe-b" />
        </footer>
      </div>
    </>,
  );
});
