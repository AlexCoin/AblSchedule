/** Hosting-provided HTTPS origin is used when a custom APP_URL is not configured. */
export function configuredAppUrl() {
  return process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
}
