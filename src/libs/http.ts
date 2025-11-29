import axios, { type InternalAxiosRequestConfig } from "axios";

const requestInterceptor = (config: InternalAxiosRequestConfig) => {
  console.info("⬆️", config.method?.toUpperCase(), axios.getUri(config));
  return config;
};

export const http = axios.create({
  adapter: "fetch",
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36",
  },
});

http.interceptors.request.use(requestInterceptor);

export const tmdbHttp = axios.create({
  adapter: "fetch",
  baseURL: "https://api.themoviedb.org/3",
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
  },
});

tmdbHttp.interceptors.request.use(requestInterceptor);
