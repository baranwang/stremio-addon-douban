# AGENTS.md

## 项目概述

Stremio 豆瓣插件 - 一个为 Stremio 提供豆瓣内容的 Cloudflare Workers 应用。

## 开发命令

- 安装依赖: `pnpm install`
- 开发服务器: `pnpm dev`
- 构建: `pnpm build`
- 部署: `pnpm deploy`
- 生成迁移: `pnpm drizzle-kit generate`
- 应用迁移: `npx wrangler d1 migrations apply stremio-addon-douban --remote`

## 技术栈

- **运行时**: Cloudflare Workers
- **框架**: Hono
- **前端**: React + TailwindCSS
- **UI 组件**: 基于 shadcn/ui（组件位于 `src/components/ui/`）
- **表单**: @tanstack/react-form
- **数据库**: Cloudflare D1 (SQLite) + Drizzle ORM
- **缓存**: Cloudflare KV

## 代码规范

- TypeScript 严格模式
- 使用 Biome 进行格式化和 lint
- 函数式编程风格优先

## 数据库规范

- **禁止使用外键约束** (`.references()`)
  - SQLite 不支持 `ALTER TABLE ... DROP COLUMN`，需要重建表
  - `ON DELETE CASCADE` 在重建表时可能导致数据丢失
  - 在应用层处理关联关系

```typescript
// ❌ 不要使用外键
userId: text("user_id").references(() => users.id, { onDelete: "cascade" });

// ✅ 正确做法
userId: text("user_id").primaryKey();
```

## UI 组件规范

- 优先使用 `src/components/ui/` 中的 shadcn/ui 组件
- 新组件应遵循 shadcn/ui 的设计模式
- 使用 `cn()` 工具函数合并 class names
- **每个文件只包含一个组件**，子组件应拆分到同目录下的独立文件中

## 目录结构

```
src/
├── components/     # React 组件
│   └── ui/         # shadcn/ui 基础组件
├── db/             # Drizzle schema
├── libs/           # 工具库和 API 客户端
└── routes/         # Hono 路由
drizzle/            # 数据库迁移文件
```
