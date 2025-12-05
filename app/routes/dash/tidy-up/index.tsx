import { isNull } from "drizzle-orm";
import { createRoute } from "honox/factory";
import { doubanMapping } from "@/db";
import { api } from "@/libs/api";
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./-components";

export default createRoute(async (c) => {
  api.initialize(c.env, c.executionCtx);

  const data = await api.db.select().from(doubanMapping).where(isNull(doubanMapping.tmdbId));

  return c.render(
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text font-bold text-3xl text-transparent tracking-tight">
                ID 映射整理
              </h1>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">以下条目缺少 TMDB ID，需要手动补充</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="warning">{data.length} 条待处理</Badge>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <svg
                  className="h-5 w-5 text-amber-600 dark:text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">缺少 TMDB ID</p>
                <p className="font-bold text-2xl text-zinc-900 dark:text-zinc-100">{data.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <svg
                  className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">有 IMDb ID</p>
                <p className="font-bold text-2xl text-zinc-900 dark:text-zinc-100">
                  {data.filter((item) => item.imdbId).length}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <svg
                  className="h-5 w-5 text-blue-600 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">有 Trakt ID</p>
                <p className="font-bold text-2xl text-zinc-900 dark:text-zinc-100">
                  {data.filter((item) => item.traktId).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        {data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>豆瓣 ID</TableHead>
                <TableHead>IMDb ID</TableHead>
                <TableHead>TMDB ID</TableHead>
                <TableHead>Trakt ID</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="w-32 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={item.doubanId}>
                  <TableCell className="font-medium text-zinc-500">{index + 1}</TableCell>
                  <TableCell>
                    <a
                      href={`https://movie.douban.com/subject/${item.doubanId}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-emerald-600 hover:text-emerald-700 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
                    >
                      {item.doubanId}
                    </a>
                  </TableCell>
                  <TableCell>
                    {item.imdbId ? (
                      <Badge variant="success">{item.imdbId}</Badge>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.tmdbId ? <Badge variant="info">{item.tmdbId}</Badge> : <Badge variant="danger">缺失</Badge>}
                  </TableCell>
                  <TableCell>
                    {item.traktId ? (
                      <Badge variant="default">{item.traktId}</Badge>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500">{item.createdAt?.toLocaleDateString("zh-CN")}</TableCell>
                  <TableCell className="text-xs text-zinc-500">{item.updatedAt?.toLocaleDateString("zh-CN")}</TableCell>
                  <TableCell className="text-right">
                    <a href={`/dash/tidy-up/${item.doubanId}`}>
                      <Button variant="secondary" size="sm">
                        <svg
                          className="mr-1.5 h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        编辑
                      </Button>
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-zinc-200 border-dashed bg-white/50 py-16 dark:border-zinc-800 dark:bg-zinc-900/50">
            <svg
              className="mb-4 h-16 w-16 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="font-semibold text-xl text-zinc-900 dark:text-zinc-100">全部完成！</h3>
            <p className="mt-2 text-zinc-500">暂无需要整理的 ID 映射</p>
          </div>
        )}
      </div>
    </div>,
  );
});
