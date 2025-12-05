import axios, { type AxiosInstance, type AxiosRequestConfig, type CreateAxiosDefaults } from "axios";
import { drizzle } from "drizzle-orm/d1";
import type { ExecutionContext } from "hono";
import { doubanMapping } from "@/db";

export class BaseAPI {
  private _context?: ExecutionContext;
  protected get context() {
    if (!this._context) {
      throw new Error("Context not initialized");
    }
    return this._context;
  }
  protected set context(context: ExecutionContext) {
    this._context = context;
  }

  private _env?: CloudflareBindings;
  protected get env() {
    if (!this._env) {
      throw new Error("Env not initialized");
    }
    return this._env;
  }
  protected set env(env: CloudflareBindings) {
    this._env = env;
  }

  initialize(env: CloudflareBindings, ctx: ExecutionContext) {
    this.env = env;
    this.context = ctx;
  }

  protected axios: AxiosInstance;

  constructor(config?: CreateAxiosDefaults) {
    this.axios = axios.create({
      adapter: "fetch",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...config?.headers,
      },
      ...config,
    });

    this.axios.interceptors.request.use((config) => {
      const finalUri = axios.getUri(config);
      console.info("⬆️", config.method?.toUpperCase(), finalUri);
      return config;
    });
    this.axios.interceptors.response.use((response) => {
      console.info("⬇️", response.status, axios.getUri(response.config));
      if (response.status >= 400) {
        console.error("❌", response.status, response.data);
      }
      return response;
    });
  }

  private requestMap = new Map<string, Promise<unknown>>();

  protected async request<T>(config: AxiosRequestConfig & { cache?: { key: string; ttl: number } }) {
    const cacheConfig = config.cache;
    const requestKey = cacheConfig?.key;

    const cache = caches.default;
    const cacheKey = new Request(`https://cache.internal/${requestKey}`);

    // 1. 检查持久化缓存
    if (cacheConfig) {
      const cachedRes = await cache.match(cacheKey);
      if (cachedRes) {
        console.info("⚡️ Cache Hit", requestKey);
        return cachedRes.json() as T;
      }
      console.info("🐢 Cache Miss", requestKey);
    }

    // 2. 检查进行中的请求（请求去重）
    if (requestKey && this.requestMap.has(requestKey)) {
      console.info("🔄 Dedup Hit", requestKey);
      return this.requestMap.get(requestKey) as Promise<T>;
    }

    // 3. 发起新请求
    const fetchData = async (): Promise<T> => {
      try {
        const resp = await this.axios.request<T>(config);
        const respData = resp.data;

        // 写入持久化缓存
        if (cacheConfig) {
          const response = new Response(JSON.stringify(respData), {
            headers: {
              "Cache-Control": `public, max-age=${cacheConfig.ttl / 1000}, s-maxage=${cacheConfig.ttl / 1000}`,
            },
          });
          this.context.waitUntil(cache.put(cacheKey, response));
        }

        return respData;
      } finally {
        // 无论成功或失败都清理 requestMap
        if (requestKey) {
          this.requestMap.delete(requestKey);
        }
      }
    };

    const promise = fetchData();

    // 存储 promise 用于去重
    if (requestKey) {
      this.requestMap.set(requestKey, promise);
    }

    return promise;
  }

  get db() {
    return drizzle(this.env.STREMIO_ADDON_DOUBAN, {
      schema: {
        doubanMapping,
      },
    });
  }
}
