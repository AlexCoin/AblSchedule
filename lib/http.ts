import { configuredAppUrl } from "./app-url";
/** Browser POSTs must come from this deployment. Host is browser controlled. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    return configuredAppUrl()
      ? url.origin === new URL(configuredAppUrl()!).origin
      : url.host === req.headers.get("host");
  } catch {
    return false;
  }
}
