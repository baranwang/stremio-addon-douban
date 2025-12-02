import { match, type ParamData, type Path } from "path-to-regexp";

export function matchRoute<P extends ParamData>(path: Path | Path[], pathname: string) {
  const matcher = match<P>(path);
  const matches = matcher(pathname);
  if (matches) {
    return [true, matches.params] as const;
  }
  return [false, null] as const;
}

export const parseExtra = (value: string | undefined) => {
  if (!value) return {};
  return Object.fromEntries(new URLSearchParams(value));
};

export const matchResourceRoute = (pathname: string) => {
  const [matched, result] = matchRoute<{
    resource: string;
    type: string;
    id: string;
    extra?: string;
  }>("/:resource/:type/:id{/:extra}.json", pathname);
  if (!matched) return [false, null] as const;

  return [
    true,
    {
      ...result,
      extra: parseExtra(result.extra),
    },
  ] as const;
};
