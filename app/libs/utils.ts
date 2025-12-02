import type { Context } from "hono";

export const isForwardUserAgent = (c: Context) => {
  const userAgent = c.req.header("User-Agent");
  return userAgent?.split(" ").some((item) => item.startsWith("forward/"));
};
