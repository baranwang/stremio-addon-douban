import { type ClassValue, clsx } from "clsx";
import type { Context } from "hono";
import { twMerge } from "tailwind-merge";
import type { Config } from "./config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isForwardUserAgent = (c: Context) => {
  const userAgent = c.req.header("User-Agent");
  return userAgent?.split(" ").some((item) => item.startsWith("forward/"));
};

export const generateImageUrl = (href: string, imageProxy?: Config["imageProxy"]) => {
  if (!href) {
    return "";
  }
  switch (imageProxy) {
    case "weserv": {
      const url = new URL("https://images.weserv.nl");
      url.searchParams.set("url", href);
      return url.toString();
    }
    default:
      return href;
  }
};
