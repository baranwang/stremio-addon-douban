import { isEqual } from "es-toolkit";
import { hc } from "hono/client";
import { Check, Copy, Film, Settings, Tv } from "lucide-react";
import { type FC, Fragment, useActionState, useCallback, useEffect, useMemo, useState } from "react";
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
import { COLLECTION_CONFIGS } from "@/libs/catalog-shared";
import type { Config } from "@/libs/config";
import type { ConfigureRoute } from "@/routes/configure";
import { SettingSection } from "./setting-section";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "./ui/input-group";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Spinner } from "./ui/spinner";

export interface ConfigureProps {
  config: Config;
  manifestUrl: string;
  user?: User;
}

// 按类型分组
const movieConfigs = COLLECTION_CONFIGS.filter((c) => c.type === "movie");
const seriesConfigs = COLLECTION_CONFIGS.filter((c) => c.type === "series");

const client = hc<ConfigureRoute>("/configure");

export const Configure: FC<ConfigureProps> = ({ config: initialConfig, manifestUrl, user }) => {
  const [config, setConfig] = useState(initialConfig);
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // ignore
    }
  }, []);

  const isNoneSelected = config.catalogIds.length === 0;

  // 检查配置是否有变化
  const hasChanges = useMemo(() => !isEqual(config, initialConfig), [config, initialConfig]);

  const toggleItem = (id: string, checked: boolean) => {
    setConfig((prev) => ({
      ...prev,
      catalogIds: checked ? [...prev.catalogIds, id] : prev.catalogIds.filter((i) => i !== id),
    }));
  };

  const renderItems = (items: typeof COLLECTION_CONFIGS) =>
    items.map((item, index, array) => (
      <Fragment key={item.id}>
        <Item size="sm" asChild>
          <label>
            <ItemContent>
              <ItemTitle>{item.name}</ItemTitle>
              {item.extra && <ItemDescription>支持分类筛选</ItemDescription>}
            </ItemContent>
            <ItemActions>
              <Switch
                checked={config.catalogIds.includes(item.id)}
                onCheckedChange={(checked) => toggleItem(item.id, checked)}
              />
            </ItemActions>
          </label>
        </Item>
        {index !== array.length - 1 && <ItemSeparator />}
      </Fragment>
    ));

  const [actionState, formAction, isPending] = useActionState(
    async () => {
      if (!user?.hasStarred) return { success: false, message: "" };
      try {
        const res = await client.index.$put({ json: config });
        return res.json();
      } catch {
        return { success: false, message: "保存失败，请稍后重试" };
      }
    },
    { success: false, message: "" },
  );

  useEffect(() => {
    if (actionState.success) {
      toast.success("配置已保存");
    } else if (actionState.message) {
      toast.error(actionState.message);
    }
  }, [actionState]);

  const isStarredUser = !!user?.hasStarred;

  const formProps = useMemo<React.FormHTMLAttributes<HTMLFormElement>>(
    () => (isStarredUser ? { action: formAction } : { method: "post" as const }),
    [isStarredUser, formAction],
  );

  const buttonProps = useMemo(() => {
    const props: React.ComponentProps<typeof Button> = {
      disabled: isNoneSelected || hasChanges,
    };
    if (!isStarredUser) {
      props.children = "生成配置链接";
    } else {
      if (isPending) {
        props.disabled = true;
        props.children = (
          <>
            <Spinner />
            保存中...
          </>
        );
      } else {
        props.children = "保存配置";
      }
    }
    return props;
  }, [isNoneSelected, isPending, isStarredUser, hasChanges]);

  return (
    <>
      <form {...formProps} className="flex h-full flex-col">
        {/* 中间：可滚动的列表 */}
        <div className="relative flex-1 overflow-hidden">
          <div className="h-full space-y-4 overflow-y-auto pb-4">
            <div className="page-container px-4">
              <SettingSection title="通用" icon={<Settings className="size-4 text-muted-foreground" />}>
                <ItemGroup className="rounded-lg border">
                  <Item size="sm">
                    <ItemContent>
                      <ItemTitle>启用动态集合</ItemTitle>
                      <ItemDescription>豆瓣会不定期更新一些集合，启用后会自动添加</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Switch
                        name="dynamicCollections"
                        checked={config.dynamicCollections}
                        onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, dynamicCollections: checked }))}
                      />
                    </ItemActions>
                  </Item>

                  <ItemSeparator />

                  <Item size="sm">
                    <ItemContent>
                      <ItemTitle>图片代理</ItemTitle>
                      <ItemDescription>
                        选择图片代理服务（针对 Stremio 用户优化，Forward 用户不建议开启）
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <NativeSelect
                        name="imageProxy"
                        value={config.imageProxy}
                        size="sm"
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, imageProxy: e.target.value as Config["imageProxy"] }))
                        }
                      >
                        <NativeSelectOption value="none">不使用代理</NativeSelectOption>
                        <NativeSelectOption value="weserv">Weserv</NativeSelectOption>
                      </NativeSelect>
                    </ItemActions>
                  </Item>
                </ItemGroup>
              </SettingSection>

              {/* 电影分类 */}
              <SettingSection
                title="电影"
                icon={<Film className="size-4 text-muted-foreground" />}
                extra={
                  <Badge variant="outline" className="ml-auto">
                    {movieConfigs.filter((c) => config.catalogIds.includes(c.id)).length}/{movieConfigs.length}
                  </Badge>
                }
              >
                <ItemGroup className="rounded-lg border">{renderItems(movieConfigs)}</ItemGroup>
              </SettingSection>

              {/* 剧集分类 */}
              <SettingSection
                title="剧集"
                icon={<Tv className="size-4 text-muted-foreground" />}
                extra={
                  <Badge variant="outline" className="ml-auto">
                    {seriesConfigs.filter((c) => config.catalogIds.includes(c.id)).length}/{seriesConfigs.length}
                  </Badge>
                }
              >
                <ItemGroup className="rounded-lg border">{renderItems(seriesConfigs)}</ItemGroup>
              </SettingSection>
            </div>
          </div>

          {/* 底部渐变遮罩 */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-background to-transparent" />
        </div>

        <input type="hidden" name="catalogIds" value={config.catalogIds.join(",")} />

        {/* 底部：固定操作区 */}
        <div className="page-container shrink-0 space-y-3 px-4 pt-4">
          <div className="space-y-1.5">
            <label htmlFor="manifest-url" className="text-muted-foreground text-xs">
              Manifest 链接
            </label>
            <InputGroup>
              <InputGroupInput id="manifest-url" value={manifestUrl} readOnly className="font-mono text-xs" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  onClick={() => copyToClipboard(manifestUrl)}
                  aria-label="复制链接"
                  className={isCopied ? "text-green-500" : ""}
                >
                  {isCopied ? <Check /> : <Copy />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>

          <Button type="submit" className="w-full" size="lg" {...buttonProps} />
        </div>
      </form>
      <Toaster />
    </>
  );
};
