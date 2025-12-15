import { useCallback, useState } from "hono/jsx/dom";
import { Check, Copy, Film, Tv } from "lucide-react";
import { type FC, Fragment } from "react";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { COLLECTION_CONFIGS } from "@/libs/constants";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "./ui/input-group";

export interface ConfigureProps {
  initialSelectedIds: string[];
  manifestUrl: string;
}

// 按类型分组
const movieConfigs = COLLECTION_CONFIGS.filter((c) => c.type === "movie");
const seriesConfigs = COLLECTION_CONFIGS.filter((c) => c.type === "series");

export const Configure: FC<ConfigureProps> = ({ initialSelectedIds, manifestUrl }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
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

  const isNoneSelected = selectedIds.length === 0;

  const toggleItem = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((i) => i !== id)));
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
                checked={selectedIds.includes(item.id)}
                onCheckedChange={(checked) => toggleItem(item.id, checked)}
              />
            </ItemActions>
          </label>
        </Item>
        {index !== array.length - 1 && <ItemSeparator />}
      </Fragment>
    ));

  return (
    <form method="post" className="flex h-full flex-col">
      {/* 中间：可滚动的列表 */}
      <div className="relative flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 pb-4">
          {/* 电影分类 */}
          <div className="mb-4">
            <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 py-2 backdrop-blur-sm">
              <Film className="size-4 text-muted-foreground" />
              <span className="font-medium text-sm">电影</span>
              <Badge variant="outline" className="ml-auto">
                {movieConfigs.filter((c) => selectedIds.includes(c.id)).length}/{movieConfigs.length}
              </Badge>
            </div>
            <ItemGroup className="rounded-lg border">{renderItems(movieConfigs)}</ItemGroup>
          </div>

          {/* 剧集分类 */}
          <div>
            <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 py-2 backdrop-blur-sm">
              <Tv className="size-4 text-muted-foreground" />
              <span className="font-medium text-sm">剧集</span>
              <Badge variant="outline" className="ml-auto">
                {seriesConfigs.filter((c) => selectedIds.includes(c.id)).length}/{seriesConfigs.length}
              </Badge>
            </div>
            <ItemGroup className="rounded-lg border">{renderItems(seriesConfigs)}</ItemGroup>
          </div>
        </div>

        {/* 底部渐变遮罩 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-background to-transparent" />
      </div>

      <input type="hidden" name="catalogIds" value={selectedIds.join(",")} />

      {/* 底部：固定操作区 */}
      <div className="shrink-0 space-y-3 p-4">
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

        <Button type="submit" className="w-full" size="lg" disabled={isNoneSelected}>
          生成配置链接
        </Button>

        <div className="h-safe-b" />
      </div>
    </form>
  );
};
