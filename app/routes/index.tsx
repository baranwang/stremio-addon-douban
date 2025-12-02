import { createRoute } from "honox/factory";
import pkg from "@/../package.json";
import { ManifestUrlRender } from "@/islands/manifest-url-render";

export default createRoute((c) => {
  const manifestUrl = new URL(c.req.url);
  manifestUrl.pathname = "/manifest.json";
  manifestUrl.search = "";
  manifestUrl.hash = "";
  return c.render(
    <div className="flex h-screen flex-col items-center justify-center">
      <h1 className="mb-4 font-bold text-2xl">
        {pkg.description}

        <span className="ml-2 text-base text-neutral-500">v{pkg.version}</span>
      </h1>

      <ManifestUrlRender url={manifestUrl.toString()} />
    </div>,
  );
});
