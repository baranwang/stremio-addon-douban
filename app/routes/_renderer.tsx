import { jsxRenderer } from "hono/jsx-renderer";
import { Link, Script } from "honox/server";
import pkg from "@/../package.json";

export default jsxRenderer(({ children }) => {
  return (
    <html lang="zh">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{pkg.description}</title>
        <Link href="/app/style.css" rel="stylesheet" />
        <Script src="/app/client.ts" async />
      </head>
      <body>{children}</body>
    </html>
  );
});
