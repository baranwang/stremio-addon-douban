import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X } from "lucide-react";
import { type FC, useMemo, useState } from "react";
import { Item, ItemActions, ItemContent, ItemTitle } from "@/components/ui/item";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { getAllLanguages, getCountriesForLanguage, getLanguageDisplayName } from "./language-utils";

interface TmdbLanguageSortableProps {
  value: string[];
  onChange: (languages: string[]) => void;
}

interface SortableLanguageItemProps {
  code: string;
  onRemove: () => void;
  canRemove: boolean;
}

const SortableLanguageItem: FC<SortableLanguageItemProps> = ({ code, onRemove, canRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: code,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Item size="sm">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <ItemContent>
          <ItemTitle>
            <span className="font-mono text-muted-foreground text-xs">{code}</span>
            <span>{getLanguageDisplayName(code)}</span>
          </ItemTitle>
        </ItemContent>
        <ItemActions>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 text-muted-foreground hover:text-destructive"
              aria-label="移除语言"
            >
              <X className="size-4" />
            </button>
          )}
        </ItemActions>
      </Item>
    </div>
  );
};

export const TmdbLanguageSortable: FC<TmdbLanguageSortableProps> = ({ value, onChange }) => {
  const [selectedLang, setSelectedLang] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const allLanguages = useMemo(() => getAllLanguages(), []);

  // 获取选中语言对应的国家列表
  const countriesForLang = useMemo(() => (selectedLang ? getCountriesForLanguage(selectedLang) : []), [selectedLang]);

  // 计算最终要添加的语言代码
  const codeToAdd = useMemo(() => {
    if (!selectedLang) return "";
    if (selectedCountry) return `${selectedLang}-${selectedCountry}`;
    return selectedLang;
  }, [selectedLang, selectedCountry]);

  // 是否已存在
  const alreadyExists = value.includes(codeToAdd);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const oldIndex = value.indexOf(activeId);
    const newIndex = value.indexOf(overId);

    if (oldIndex !== -1 && newIndex !== -1) {
      onChange(arrayMove(value, oldIndex, newIndex));
    }
  };

  const handleAdd = () => {
    if (codeToAdd && !alreadyExists) {
      onChange([...value, codeToAdd]);
      setSelectedLang("");
      setSelectedCountry("");
    }
  };

  const handleRemove = (code: string) => {
    // 至少保留一个语言
    if (value.length <= 1) return;
    onChange(value.filter((c) => c !== code));
  };

  // 处理语言选择变化
  const handleLangChange = (lang: string) => {
    setSelectedLang(lang);
    setSelectedCountry(""); // 重置国家选择
  };

  return (
    <Item size="sm">
      <ItemContent className="flex-1">
        <ItemTitle className="mb-2">图片语言偏好</ItemTitle>

        <div className="rounded-md border bg-muted/30">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={value} strategy={verticalListSortingStrategy}>
              {value.map((code) => (
                <SortableLanguageItem
                  key={code}
                  code={code}
                  onRemove={() => handleRemove(code)}
                  canRemove={value.length > 1}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* 两步添加语言 */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            {/* 第一步：选择语言 */}
            <NativeSelect className="flex-1" value={selectedLang} onChange={(e) => handleLangChange(e.target.value)}>
              <NativeSelectOption value="">选择语言...</NativeSelectOption>
              <NativeSelectOptGroup label="常用语言">
                {["zh", "en", "ja", "ko", "es", "fr", "de", "pt", "ru", "it"].map((code) => {
                  const lang = allLanguages.find((l) => l.code === code);
                  return lang ? (
                    <NativeSelectOption key={code} value={code}>
                      {lang.code}（{lang.native}）
                    </NativeSelectOption>
                  ) : null;
                })}
              </NativeSelectOptGroup>
              <NativeSelectOptGroup label="所有语言">
                {allLanguages.map((lang) => (
                  <NativeSelectOption key={lang.code} value={lang.code}>
                    {lang.code}（{lang.native}）
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
              <NativeSelectOptGroup label="特殊">
                <NativeSelectOption value="null">无语言标签 (No Language)</NativeSelectOption>
              </NativeSelectOptGroup>
            </NativeSelect>

            {/* 第二步：选择国家（可选） */}
            {selectedLang && selectedLang !== "null" && countriesForLang.length > 0 && (
              <NativeSelect
                className="flex-1"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
              >
                <NativeSelectOption value="">不指定国家/地区</NativeSelectOption>
                {countriesForLang.map((country) => (
                  <NativeSelectOption key={country.code} value={country.code}>
                    {country.code}（{country.native}）
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}

            <button
              type="button"
              onClick={handleAdd}
              disabled={!codeToAdd || alreadyExists}
              className="flex h-9 shrink-0 items-center gap-1 rounded-md border bg-background px-3 text-sm disabled:opacity-50"
            >
              <Plus className="size-4" />
              添加
            </button>
          </div>

          {/* 预览要添加的代码 */}
          {codeToAdd && (
            <p className="text-muted-foreground text-xs">
              将添加: <code className="rounded bg-muted px-1">{codeToAdd}</code>
              {alreadyExists && <span className="ml-2 text-destructive">（已存在）</span>}
            </p>
          )}
        </div>

        <p className="mt-2 text-muted-foreground text-xs">拖动排序调整优先级，排在前面的语言将优先使用</p>
      </ItemContent>
    </Item>
  );
};
