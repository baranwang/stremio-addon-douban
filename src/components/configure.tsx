import { useForm } from "@tanstack/react-form";
import { isEqual } from "es-toolkit";
import { hc } from "hono/client";
import { Check, Copy, Film, HardDriveDownload, Settings, Tv } from "lucide-react";
import { type FC, Fragment, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import type { User } from "@/db";
import {
  COLLECTION_CONFIGS,
  isYearlyRankingId,
  MOVIE_GENRE_CONFIGS,
  MOVIE_YEARLY_RANKING_ID,
  TV_GENRE_CONFIGS,
  TV_YEARLY_RANKING_ID,
} from "@/libs/collections";
import type { Config } from "@/libs/config";
import type { ConfigureRoute } from "@/routes/configure";
import { GenreDrawer } from "./genre-drawer";
import { SettingSection } from "./setting-section";
import { Button } from "./ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "./ui/input-group";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Spinner } from "./ui/spinner";
import { YearlyRankingDrawer } from "./yearly-ranking-drawer";

export interface ConfigureProps {
  config: Config;
  manifestUrl: string;
  user?: User;
}

const client = hc<ConfigureRoute>("/configure");

export const Configure: FC<ConfigureProps> = ({ config: initialConfig, manifestUrl: initialManifestUrl, user }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [manifestUrl, setManifestUrl] = useState(initialManifestUrl);
  const isStarredUser = !!user?.hasStarred;

  const form = useForm({
    defaultValues: initialConfig,
    onSubmit: async ({ value }) => {
      try {
        const res = await client.index.$post({ json: value });
        const result = await res.json();
        if (result.success && result.manifestUrl) {
          setManifestUrl(result.manifestUrl);
          toast.success(isStarredUser ? "配置已保存" : "配置链接已生成");
        } else {
          toast.error("保存失败");
        }
      } catch {
        toast.error("保存失败，请稍后重试");
      }
    },
  });

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // ignore
    }
  }, []);

  // 创建类型榜单 ID 集合，用于过滤
  const movieGenreIds = useMemo(() => new Set(MOVIE_GENRE_CONFIGS.map((c) => c.id)), []);
  const tvGenreIds = useMemo(() => new Set(TV_GENRE_CONFIGS.map((c) => c.id)), []);

  const getConfigsByType = useCallback(
    (type: "movie" | "series") => {
      const genreIds = type === "movie" ? movieGenreIds : tvGenreIds;
      // 过滤掉类型榜单和年度榜单，它们会单独渲染为抽屉
      return COLLECTION_CONFIGS.filter((c) => c.type === type && !genreIds.has(c.id) && !isYearlyRankingId(c.id));
    },
    [movieGenreIds, tvGenreIds],
  );

  const movieConfigs = useMemo(() => getConfigsByType("movie"), [getConfigsByType]);
  const seriesConfigs = useMemo(() => getConfigsByType("series"), [getConfigsByType]);

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="flex h-full flex-col"
      >
        {/* 中间：可滚动的列表 */}
        <div className="relative flex-1 overflow-hidden">
          <div className="h-full space-y-4 overflow-y-auto pb-4">
            <div className="page-container space-y-4 px-4">
              <SettingSection title="通用" icon={<Settings className="size-4 text-muted-foreground" />}>
                <ItemGroup className="rounded-lg border">
                  {/* 图片代理 */}
                  <form.Field name="imageProxy">
                    {(field) => (
                      <Item size="sm">
                        <ItemContent>
                          <ItemTitle>选择图片代理服务</ItemTitle>
                          <ItemDescription>针对 Stremio 用户优化，Forward 等客户端用户不建议开启</ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <NativeSelect
                            name={field.name}
                            value={field.state.value}
                            size="sm"
                            onChange={(e) => field.handleChange(e.target.value as Config["imageProxy"])}
                          >
                            <NativeSelectOption value="none">不使用代理</NativeSelectOption>
                            <NativeSelectOption value="weserv">Weserv</NativeSelectOption>
                          </NativeSelect>
                        </ItemActions>
                      </Item>
                    )}
                  </form.Field>

                  <ItemSeparator />

                  {/* Fanart 开关 */}
                  <form.Field name="fanart.enabled">
                    {(field) => (
                      <Item size="sm">
                        <ItemContent>
                          <ItemTitle className={!user?.hasStarred ? "text-muted-foreground" : undefined}>
                            使用 Fanart 图片
                          </ItemTitle>
                          <ItemDescription>
                            {user?.hasStarred
                              ? "使用 fanart.tv 提供高清海报、背景和 Logo，若 Fanart 未匹配到图片，则降级使用豆瓣"
                              : "使用 GitHub 登录并星标本项目可开启此功能"}
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <Switch
                            checked={field.state.value}
                            disabled={!user?.hasStarred}
                            onCheckedChange={field.handleChange}
                          />
                        </ItemActions>
                      </Item>
                    )}
                  </form.Field>

                  {/* Fanart API Key */}
                  <form.Subscribe selector={(state) => state.values.fanart.enabled}>
                    {(fanartEnabled) =>
                      !!(fanartEnabled && user?.hasStarred) && (
                        <>
                          <ItemSeparator />
                          <form.Field name="fanart.apiKey">
                            {(field) => (
                              <Item size="sm">
                                <ItemContent className="flex-1">
                                  <ItemTitle>Fanart API 密钥（可选）</ItemTitle>
                                  <ItemDescription>
                                    未提供密钥仅显示 7 天前过审图片，提供后缩短至 48 小时，VIP 为 10 分钟。
                                    <a
                                      href="https://wiki.fanart.tv/General/personal%20api/"
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      了解更多
                                    </a>
                                  </ItemDescription>
                                  <InputGroup className="mt-2">
                                    <InputGroupInput
                                      type="password"
                                      placeholder="请输入你的 API 密钥"
                                      value={field.state.value ?? ""}
                                      onChange={(e) => field.handleChange(e.target.value || undefined)}
                                    />
                                    <InputGroupAddon align="inline-end">
                                      <InputGroupButton asChild>
                                        <a href="https://fanart.tv/get-an-api-key/" target="_blank" rel="noreferrer">
                                          获取 API 密钥
                                        </a>
                                      </InputGroupButton>
                                    </InputGroupAddon>
                                  </InputGroup>
                                </ItemContent>
                              </Item>
                            )}
                          </form.Field>
                        </>
                      )
                    }
                  </form.Subscribe>

                  <ItemSeparator />

                  {/* 动态集合 */}
                  <form.Field name="dynamicCollections">
                    {(field) => (
                      <Item size="sm">
                        <ItemContent>
                          <ItemTitle>启用动态集合</ItemTitle>
                          <ItemDescription>豆瓣会不定期更新一些集合，启用后会自动添加</ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <Switch name={field.name} checked={field.state.value} onCheckedChange={field.handleChange} />
                        </ItemActions>
                      </Item>
                    )}
                  </form.Field>
                </ItemGroup>
              </SettingSection>

              <form.Field name="catalogIds" mode="array">
                {(field) => {
                  const handleChange = (id: string, checked: boolean) => {
                    field.handleChange((prev) => (checked ? [...prev, id] : prev.filter((i) => i !== id)));
                  };

                  const renderCatalogItems = (items: typeof movieConfigs) =>
                    items.map((item, index, array) => (
                      <Fragment key={item.id}>
                        <Item size="sm" asChild>
                          <label>
                            <ItemContent>
                              <ItemTitle>{item.name}</ItemTitle>
                            </ItemContent>
                            <ItemActions>
                              <Switch
                                checked={field.state.value.includes(item.id)}
                                onCheckedChange={(checked) => handleChange(item.id, checked)}
                              />
                            </ItemActions>
                          </label>
                        </Item>
                        {index !== array.length - 1 && <ItemSeparator />}
                      </Fragment>
                    ));

                  return (
                    <>
                      {/* 电影分类 */}
                      <SettingSection title="电影" icon={<Film className="size-4 text-muted-foreground" />}>
                        <ItemGroup className="rounded-lg border">
                          {renderCatalogItems(movieConfigs)}
                          <ItemSeparator />
                          <GenreDrawer
                            title="电影类型榜"
                            items={MOVIE_GENRE_CONFIGS}
                            catalogIds={field.state.value}
                            onToggle={handleChange}
                          />
                          <ItemSeparator />
                          <YearlyRankingDrawer
                            yearlyRankingId={MOVIE_YEARLY_RANKING_ID}
                            title="豆瓣年度评分最高电影"
                            catalogIds={field.state.value}
                            onToggle={handleChange}
                          />
                        </ItemGroup>
                      </SettingSection>

                      {/* 剧集分类 */}
                      <SettingSection title="剧集" icon={<Tv className="size-4 text-muted-foreground" />}>
                        <ItemGroup className="rounded-lg border">
                          {renderCatalogItems(seriesConfigs)}
                          <ItemSeparator />
                          <GenreDrawer
                            title="剧集类型榜"
                            items={TV_GENRE_CONFIGS}
                            catalogIds={field.state.value}
                            onToggle={handleChange}
                          />
                          <ItemSeparator />
                          <YearlyRankingDrawer
                            yearlyRankingId={TV_YEARLY_RANKING_ID}
                            title="豆瓣年度评分最高剧集"
                            catalogIds={field.state.value}
                            onToggle={handleChange}
                          />
                        </ItemGroup>
                      </SettingSection>
                    </>
                  );
                }}
              </form.Field>
            </div>
          </div>

          {/* 底部渐变遮罩 */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-background to-transparent" />
        </div>

        {/* 底部：固定操作区 */}
        <div className="page-container shrink-0 px-4 pt-4">
          <form.Subscribe selector={(state) => [state.values.catalogIds, state.isSubmitting, state.values] as const}>
            {([catalogIds, isSubmitting, values]) => {
              const isNoneSelected = catalogIds.length === 0;
              const hasChanges = !isEqual(values, initialConfig);

              const saveButtonText = isStarredUser ? "保存配置" : "生成配置链接";
              const loadingText = isStarredUser ? "保存中..." : "生成中...";

              return (
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="flex-2"
                    size="lg"
                    disabled={isNoneSelected || !hasChanges || isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner />
                        {loadingText}
                      </>
                    ) : (
                      saveButtonText
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="lg" className="flex-1">
                        安装
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => copyToClipboard(manifestUrl)}>
                        {isCopied ? <Check className="text-green-500" /> : <Copy />}
                        {isCopied ? "已复制" : "复制链接"}
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href={`${manifestUrl.replace(/^https?:\/\//, "stremio://")}`}>
                          <HardDriveDownload />
                          导入配置
                        </a>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            }}
          </form.Subscribe>
        </div>
      </form>
      <Toaster />
    </>
  );
};
