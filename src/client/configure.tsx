import { type JSXNode, render } from "hono/jsx/dom";
import { Configure, type ConfigureProps } from "@/components/configure";

const root = document.getElementById("configure");
const initialData = JSON.parse(document.getElementById("__INITIAL_DATA__")?.textContent || "{}") as ConfigureProps;

if (root) {
  render((<Configure {...initialData} />) as JSXNode, root);
}
