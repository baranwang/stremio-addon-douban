import type { ManifestCatalog } from "@stremio-addon/sdk";
import type { DoubanIdMapping } from "@/db";

export const COLLECTION_CONFIGS: Array<ManifestCatalog & { hasGenre?: boolean }> = [
  { id: "movie_hot_gaia", name: "豆瓣热门电影", type: "movie" },
  { id: "movie_weekly_best", name: "一周口碑电影榜", type: "movie" },
  { id: "movie_real_time_hotest", name: "实时热门电影", type: "movie" },
  { id: "movie_top250", name: "豆瓣电影 Top250", type: "movie" },
  { id: "movie_showing", name: "影院热映", type: "movie" },
  { id: "film_genre_27", name: "剧情片榜", type: "movie", hasGenre: true },
  { id: "movie_comedy", name: "喜剧片榜", type: "movie", hasGenre: true },
  { id: "movie_love", name: "爱情片榜", type: "movie", hasGenre: true },
  { id: "movie_action", name: "动作片榜", type: "movie", hasGenre: true },
  { id: "movie_scifi", name: "科幻片榜", type: "movie", hasGenre: true },
  { id: "film_genre_31", name: "动画片榜", type: "movie", hasGenre: true },
  { id: "film_genre_32", name: "悬疑片榜", type: "movie", hasGenre: true },
  { id: "film_genre_46", name: "犯罪片榜", type: "movie", hasGenre: true },
  { id: "film_genre_33", name: "惊悚片榜", type: "movie", hasGenre: true },
  { id: "film_genre_49", name: "冒险片榜", type: "movie", hasGenre: true },
  { id: "film_genre_41", name: "家庭片榜", type: "movie", hasGenre: true },
  { id: "film_genre_42", name: "儿童片榜", type: "movie", hasGenre: true },
  { id: "film_genre_44", name: "历史片榜", type: "movie", hasGenre: true },
  { id: "film_genre_39", name: "音乐片榜", type: "movie", hasGenre: true },
  { id: "film_genre_48", name: "奇幻片榜", type: "movie", hasGenre: true },
  { id: "film_genre_34", name: "恐怖片榜", type: "movie", hasGenre: true },
  { id: "film_genre_45", name: "战争片榜", type: "movie", hasGenre: true },
  { id: "film_genre_43", name: "传记片榜", type: "movie", hasGenre: true },
  { id: "film_genre_40", name: "歌舞片榜", type: "movie", hasGenre: true },
  { id: "film_genre_50", name: "武侠片榜", type: "movie", hasGenre: true },
  { id: "film_genre_37", name: "情色片榜", type: "movie", hasGenre: true },
  { id: "natural_disasters", name: "灾难片榜", type: "movie", hasGenre: true },
  { id: "film_genre_47", name: "西部片榜", type: "movie", hasGenre: true },
  { id: "film_genre_51", name: "古装片榜", type: "movie", hasGenre: true },
  { id: "ECCEPGM4Y", name: "运动片榜", type: "movie", hasGenre: true },
  { id: "film_genre_36", name: "短片榜", type: "movie", hasGenre: true },
  // --
  { id: "ECBE7RX5A", name: "豆瓣 2024 评分最高电影", type: "movie", hasGenre: true },
  { id: "ECQ46F7XI", name: "豆瓣 2023 评分最高电影", type: "movie", hasGenre: true },
  { id: "ECKA55LSA", name: "豆瓣 2022 评分最高电影", type: "movie", hasGenre: true },
  { id: "ECWY6B2GQ", name: "豆瓣 2021 评分最高电影", type: "movie", hasGenre: true },
  { id: "EC2A5MRIY", name: "豆瓣 2020 评分最高电影", type: "movie", hasGenre: true },
  { id: "ECFYHQBWQ", name: "豆瓣 2019 评分最高电影", type: "movie", hasGenre: true },
  { id: "2018_movie_1", name: "豆瓣 2018 评分最高电影", type: "movie", hasGenre: true },
  { id: "2017_movie_chinese_score", name: "豆瓣 2017 评分最高电影", type: "movie", hasGenre: true },
  { id: "2016_movie_451", name: "豆瓣 2016 评分最高电影", type: "movie", hasGenre: true },
  { id: "2015_movie_3", name: "豆瓣 2015 评分最高电影", type: "movie", hasGenre: true },
  { id: "2014_movie_2", name: "豆瓣 2014 评分最高电影", type: "movie", hasGenre: true },
  // --
  { id: "tv_hot", name: "近期热门剧集", type: "series" },
  { id: "show_hot", name: "近期热门综艺节目", type: "series" },
  { id: "tv_animation", name: "近期热门动画", type: "series" },
  { id: "tv_real_time_hotest", name: "实时热门电视", type: "series" },
  { id: "tv_chinese_best_weekly", name: "华语口碑剧集榜", type: "series" },
  { id: "tv_global_best_weekly", name: "全球口碑剧集榜", type: "series" },
  { id: "show_chinese_best_weekly", name: "国内口碑综艺榜", type: "series" },
  { id: "show_global_best_weekly", name: "国外口碑综艺榜", type: "series" },
  // --
  { id: "EC74443FY", name: "大陆剧榜", type: "series", hasGenre: true },
  { id: "ECFA5DI7Q", name: "美剧榜", type: "series", hasGenre: true },
  { id: "ECVACXBWI", name: "英剧榜", type: "series", hasGenre: true },
  { id: "ECNA46YBA", name: "日剧榜", type: "series", hasGenre: true },
  { id: "ECBE5CBEI", name: "韩剧榜", type: "series", hasGenre: true },
  { id: "ECVM47WUA", name: "港剧榜", type: "series", hasGenre: true },
  { id: "ECBI5EL6A", name: "台剧榜", type: "series", hasGenre: true },
  { id: "ECRM5BIFQ", name: "泰剧榜", type: "series", hasGenre: true },
  { id: "EC6I5FYHA", name: "欧洲剧榜", type: "series", hasGenre: true },
  // --
  { id: "ECYA7RAZQ", name: "豆瓣 2024 评分最高剧集", type: "series", hasGenre: true },
  { id: "ECTE6EOZA", name: "豆瓣 2023 评分最高剧集", type: "series", hasGenre: true },
  { id: "ECWU56XUI", name: "豆瓣 2022 评分最高剧集", type: "series", hasGenre: true },
  { id: "ECOY56I6Y", name: "豆瓣 2021 评分最高剧集", type: "series", hasGenre: true },
  { id: "ECCM5TXSI", name: "豆瓣 2020 评分最高剧集", type: "series", hasGenre: true },
  { id: "ECR4HOW3I", name: "豆瓣 2019 评分最高剧集", type: "series", hasGenre: true },
  { id: "2018_tv_23", name: "豆瓣 2018 评分最高剧集", type: "series", hasGenre: true },
  { id: "2017_tv_domestic_score", name: "豆瓣 2017 评分最高剧集", type: "series", hasGenre: true },
  { id: "2016_tv_478", name: "豆瓣 2016 评分最高剧集", type: "series", hasGenre: true },
  { id: "2015_tv_6", name: "豆瓣 2015 评分最高剧集", type: "series", hasGenre: true },
  { id: "2014_tv_14", name: "豆瓣 2014 评分最高剧集", type: "series", hasGenre: true },
];

export const collectionConfigMap = new Map(COLLECTION_CONFIGS.map((item) => [item.id, item]));

export const ALL_COLLECTION_IDS = COLLECTION_CONFIGS.map((item) => item.id);
export const DEFAULT_COLLECTION_IDS = [
  "movie_hot_gaia",
  "movie_weekly_best",
  "movie_real_time_hotest",
  "movie_top250",
  "movie_showing",
  "tv_hot",
  "show_hot",
  "tv_animation",
  "tv_real_time_hotest",
  "tv_chinese_best_weekly",
  "tv_global_best_weekly",
  "show_chinese_best_weekly",
  "show_global_best_weekly",
];

export const generateId = (doubanId: number, params?: Partial<Omit<DoubanIdMapping, "doubanId">>) => {
  if (params?.tmdbId) {
    return `tmdb:${params.tmdbId}`;
  }
  if (params?.imdbId) {
    return params.imdbId;
  }
  return `douban:${doubanId}`;
};
