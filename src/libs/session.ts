import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Context, Env, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { getDrizzle, type User, type UserConfig, userConfigs, users } from "@/db";

const SESSION_COOKIE_NAME = "session";
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 天

interface SessionData {
  userId: string;
  expiresAt: number;
}

/**
 * 生成随机 session ID
 */
function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

/**
 * 获取 KV 中的 session key
 */
function getSessionKey(sessionId: string): string {
  return `session:${sessionId}`;
}

/**
 * 创建新的 session
 */
export async function createSession(c: Context<Env>, userId: string): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = Date.now() + SESSION_TTL * 1000;

  const sessionData: SessionData = {
    userId,
    expiresAt,
  };

  await c.env.KV.put(getSessionKey(sessionId), JSON.stringify(sessionData), {
    expirationTtl: SESSION_TTL,
  });

  setCookie(c, SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: SESSION_TTL,
    path: "/",
  });

  return sessionId;
}

/**
 * 获取当前 session
 */
export async function getSession(c: Context<Env>): Promise<SessionData | null> {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) {
    return null;
  }

  const sessionData = await c.env.KV.get<SessionData>(getSessionKey(sessionId), "json");
  if (!sessionData) {
    return null;
  }

  // 检查是否过期
  if (sessionData.expiresAt < Date.now()) {
    await deleteSession(c);
    return null;
  }

  return sessionData;
}

/**
 * 删除当前 session（登出）
 */
export async function deleteSession(c: Context<Env>): Promise<void> {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionId) {
    await c.env.KV.delete(getSessionKey(sessionId));
  }
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: "/",
  });
}

/**
 * 获取当前登录用户
 */
export async function getCurrentUser(c: Context<Env>): Promise<User | null> {
  const session = await getSession(c);
  if (!session) {
    return null;
  }

  const db = getDrizzle(c.env);
  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });

  return user ?? null;
}

/**
 * 获取用户配置
 */
export async function getUserConfig(c: Context<Env>, userId: string): Promise<UserConfig | null> {
  const db = getDrizzle(c.env);
  const config = await db.query.userConfigs.findFirst({ where: eq(userConfigs.userId, userId) });

  return config ?? null;
}

/**
 * 保存用户配置
 */
export async function saveUserConfig(
  c: Context<Env>,
  userId: string,
  config: {
    catalogIds: string[];
    imageProxy: string;
    dynamicCollections: boolean;
  },
): Promise<void> {
  const db = getDrizzle(c.env);

  await db
    .insert(userConfigs)
    .values({
      userId,
      catalogIds: config.catalogIds,
      imageProxy: config.imageProxy,
      dynamicCollections: config.dynamicCollections,
    })
    .onConflictDoUpdate({
      target: userConfigs.userId,
      set: {
        catalogIds: config.catalogIds,
        imageProxy: config.imageProxy,
        dynamicCollections: config.dynamicCollections,
        updatedAt: new Date(),
      },
    });
}

// 扩展 Hono 的 Context 类型
declare module "hono" {
  interface ContextVariableMap {
    user: User | null;
  }
}

/**
 * 认证中间件 - 加载用户信息到 context
 */
export const authMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  const user = await getCurrentUser(c);
  c.set("user", user);
  await next();
};
