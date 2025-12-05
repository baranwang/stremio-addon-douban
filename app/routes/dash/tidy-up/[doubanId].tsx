import { eq } from "drizzle-orm";
import { basicAuth } from "hono/basic-auth";
import { createRoute } from "honox/factory";
import { z } from "zod/v4";
import { doubanMapping, doubanMappingSchema } from "@/db";
import { api } from "@/libs/api";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./-components";

export const POST = createRoute(async (c) => {
  const doubanId = c.req.param("doubanId");
  if (!doubanId) {
    return c.notFound();
  }
  api.initialize(c.env, c.executionCtx);

  const form = await c.req.formData();

  const result = doubanMappingSchema.safeParse({
    doubanId,
    tmdbId: form.get("tmdbId"),
    imdbId: form.get("imdbId"),
    traktId: form.get("traktId"),
    calibrated: form.get("calibrated") === "on",
  });
  if (!result.success) {
    return c.json({ error: z.prettifyError(result.error) }, 400);
  }
  const { tmdbId, imdbId, traktId, calibrated } = result.data;
  await api.db
    .update(doubanMapping)
    .set({ tmdbId, imdbId, traktId, calibrated })
    .where(eq(doubanMapping.doubanId, Number.parseInt(doubanId, 10)));
  return c.redirect("/dash/tidy-up");
});

export default createRoute(basicAuth({ username: "baran", password: "930501" }), async (c) => {
  const doubanId = c.req.param("doubanId");
  if (!doubanId) {
    return c.notFound();
  }
  api.initialize(c.env, c.executionCtx);

  const [subject, idMapping] = await Promise.all([
    api.doubanAPI.getSubjectDetail(doubanId),
    api.db.query.doubanMapping.findFirst({ where: eq(doubanMapping.doubanId, Number.parseInt(doubanId, 10)) }),
  ]);

  const tmdbResults = await api.tmdbAPI
    .search(subject.type === "tv" ? "tv" : "movie", { query: subject.title, year: subject.year ?? undefined })
    .catch(() => null);

  const doubanCoverUrl = subject.cover_url || subject.pic?.large || subject.pic?.normal || "";

  const traktResults = await api.traktAPI.search(subject.type === "tv" ? "show" : "movie", subject.title);

  return c.render(
    <div className="min-h-screen bg-linear-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back Button & Header */}
        <div className="mb-8">
          <a
            href="/dash/tidy-up"
            className="mb-4 inline-flex items-center text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回列表
          </a>
          <h1 className="mt-2 bg-linear-to-r from-emerald-600 to-teal-600 bg-clip-text font-bold text-3xl text-transparent tracking-tight">
            编辑 ID 映射
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">豆瓣 ID: {doubanId}</p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column - Douban Info */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>豆瓣信息</CardTitle>
                <CardDescription>来自豆瓣的条目详情</CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  className="flex flex-col items-center"
                  href={`https://movie.douban.com/subject/${doubanId}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {doubanCoverUrl && (
                    <div className="mb-4 overflow-hidden rounded-lg shadow-lg">
                      <img
                        src={doubanCoverUrl}
                        alt={subject.title}
                        referrerpolicy="no-referrer"
                        loading="lazy"
                        className="h-72 w-48 object-cover transition-transform duration-300 hover:scale-105"
                      />
                    </div>
                  )}
                  <h3 className="text-center font-bold text-xl text-zinc-900 dark:text-zinc-100">{subject.title}</h3>
                  {subject.original_title && subject.original_title !== subject.title && (
                    <p className="mt-1 text-center text-sm text-zinc-500">{subject.original_title}</p>
                  )}
                </a>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                    <span className="text-sm text-zinc-500">类型</span>
                    <Badge variant={subject.type === "tv" ? "info" : "success"}>
                      {subject.type === "tv" ? "剧集" : "电影"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                    <span className="text-sm text-zinc-500">年份</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{subject.year || "-"}</span>
                  </div>
                  {subject.countries && subject.countries.length > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                      <span className="text-sm text-zinc-500">国家/地区</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {subject.countries.join(" / ")}
                      </span>
                    </div>
                  )}
                  {subject.languages && subject.languages.length > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                      <span className="text-sm text-zinc-500">语言</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {subject.languages.join(" / ")}
                      </span>
                    </div>
                  )}
                  {subject.directors && subject.directors.length > 0 && (
                    <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                      <span className="text-sm text-zinc-500">导演</span>
                      <p className="mt-1 font-medium text-sm text-zinc-900 dark:text-zinc-100">
                        {subject.directors.map((d) => d.name).join(" / ")}
                      </p>
                    </div>
                  )}
                  {subject.actors && subject.actors.length > 0 && (
                    <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                      <span className="text-sm text-zinc-500">演员</span>
                      <p className="mt-1 font-medium text-sm text-zinc-900 dark:text-zinc-100">
                        {subject.actors
                          .slice(0, 5)
                          .map((a) => a.name)
                          .join(" / ")}
                        {subject.actors.length > 5 && " ..."}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Trakt Results & Form */}
          <div className="space-y-6 lg:col-span-2">
            {/* Trakt Search Results */}
            <Card>
              <CardHeader>
                <CardTitle>Trakt 搜索结果</CardTitle>
                <CardDescription>根据标题搜索的 Trakt 匹配结果，点击行可快速填充</CardDescription>
              </CardHeader>
              <CardContent>
                {traktResults.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>标题</TableHead>
                        <TableHead>年份</TableHead>
                        <TableHead>Trakt ID</TableHead>
                        <TableHead>IMDb ID</TableHead>
                        <TableHead>TMDB ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {traktResults.map((result) => {
                        const ids = api.traktAPI.getSearchResultField(result, "ids");
                        return (
                          <TableRow
                            key={ids?.trakt}
                            className="cursor-pointer"
                            onclick={`
                              document.getElementById('tmdbId').value = '${ids?.tmdb || ""}';
                              document.getElementById('imdbId').value = '${ids?.imdb || ""}';
                              document.getElementById('traktId').value = '${ids?.trakt || ""}';
                            `}
                          >
                            <TableCell>
                              <div>
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                  {api.traktAPI.getSearchResultField(result, "title")}
                                </span>
                                {api.traktAPI.getSearchResultField(result, "original_title") &&
                                  api.traktAPI.getSearchResultField(result, "original_title") !==
                                    api.traktAPI.getSearchResultField(result, "title") && (
                                    <span className="ml-2 text-xs text-zinc-500">
                                      ({api.traktAPI.getSearchResultField(result, "original_title")})
                                    </span>
                                  )}
                              </div>
                            </TableCell>
                            <TableCell>{api.traktAPI.getSearchResultField(result, "year") || "-"}</TableCell>
                            <TableCell>
                              {ids?.trakt ? (
                                <span className="font-mono text-xs">{ids.trakt}</span>
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {ids?.imdb ? (
                                <Badge variant="success">{ids.imdb}</Badge>
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {ids?.tmdb ? (
                                <a
                                  href={`https://www.themoviedb.org/${subject.type}/${ids.tmdb}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Badge variant="info">{ids.tmdb}</Badge>
                                </a>
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <svg
                      className="mb-3 h-12 w-12 text-zinc-300 dark:text-zinc-700"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <p className="text-zinc-500">未找到 Trakt 匹配结果</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>TMDB 搜索结果</CardTitle>
                <CardDescription>根据标题搜索的 TMDB 匹配结果，点击行可快速填充</CardDescription>
              </CardHeader>
              <CardContent>
                {(tmdbResults?.results?.length ?? 0) > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>TMDB ID</TableHead>
                        <TableHead>封面</TableHead>
                        <TableHead>标题</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tmdbResults?.results.map((result) => {
                        return (
                          <TableRow
                            key={result.id}
                            onclick={`
                            document.getElementById('tmdbId').value = '${result.id}';
                            document.getElementById('imdbId').value = '';
                            document.getElementById('traktId').value = '';
                          `}
                          >
                            <TableCell>{result.id}</TableCell>
                            <TableCell>
                              {result.poster_path ? (
                                <img src={result.poster_path} alt={result.title} className="h-20 w-15 object-cover" />
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {result.title}
                              {result.title !== result.original_title && (
                                <span className="ml-2 text-xs text-zinc-500">({result.original_title})</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <a
                                href={`https://www.themoviedb.org/${subject.type}/${result.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                查看详情
                              </a>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <svg
                      className="mb-3 h-12 w-12 text-zinc-300 dark:text-zinc-700"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <p className="text-zinc-500">未找到 TMDB 匹配结果</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Edit Form */}
            <Card>
              <form method="post">
                <CardHeader>
                  <CardTitle>ID 映射</CardTitle>
                  <CardDescription>编辑此条目的外部 ID 映射关系</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input name="tmdbId" label="TMDB ID" value={idMapping?.tmdbId} placeholder="请输入 TMDB ID" />
                  <Input
                    name="imdbId"
                    label="IMDb ID"
                    value={idMapping?.imdbId}
                    placeholder="请输入 IMDb ID (如 tt1234567)"
                  />
                  <Input name="traktId" label="Trakt ID" value={idMapping?.traktId} placeholder="请输入 Trakt ID" />
                  <label className="flex items-center gap-2">
                    <input type="checkbox" switch checked={idMapping?.calibrated ?? false} name="calibrated" />
                    <span className="text-zinc-500 dark:text-zinc-400">已校准</span>
                  </label>
                </CardContent>
                <CardFooter className="justify-end gap-3">
                  <a href="/dash/tidy-up">
                    <Button variant="ghost">取消</Button>
                  </a>
                  <Button type="submit" variant="primary">
                    <svg
                      className="mr-1.5 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    保存
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>,
  );
});
