import type { Env } from "hono";
import { createMiddleware } from "hono/factory";
import { isUserId } from "../config";

export const rateLimit = createMiddleware<Env>(async (c, next) => {
  let success = false;

  const [, configId] = new URL(c.req.url).pathname.split("/");
  if (isUserId(configId)) {
    ({ success } = await c.env.USER_RATE_LIMIT.limit({ key: configId }));
  } else {
    const key = c.req.header("cf-connecting-ip") ?? "unknown";
    ({ success } = await c.env.PUBLIC_RATE_LIMIT.limit({ key }));
  }

  if (!success) {
    return c.text("Rate limit exceeded", 429);
  }
  await next();
});
