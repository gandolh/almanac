import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Local dev on one origin, the way Caddy serves the deploy: `/almanac-api` is
 * the API with the prefix stripped, so paths match production. The session
 * cookie is scoped to that prefix, and so are the auth routes and Ward's
 * callback (`/almanac-api/auth/ward/callback`), so this one rule carries all
 * of it. Ward itself is reached at its own origin and needs no rule.
 *
 * The server refuses a write whose `Origin` isn't its PUBLIC_ORIGIN
 * (`http://localhost:5177` by default). So a request whose `Origin` is exactly
 * the address the browser opened this server at (its `Host`) reaches the API
 * with PUBLIC_ORIGIN instead. Any other `Origin` passes through untouched and
 * is refused, as in production, where there is no Vite. (`changeOrigin` stays
 * off: it would replace the `Host` this compares against.)
 */
function devProxy(env: Record<string, string>): Record<string, ProxyOptions> {
  const publicOrigin = env.PUBLIC_ORIGIN || "http://localhost:5177";
  return {
    "/almanac-api": {
      target: `http://127.0.0.1:${env.PORT || 8809}`,
      rewrite: (url) => url.replace(/^\/almanac-api/, ""),
      configure: (proxy) => {
        proxy.on("proxyReq", (proxyReq, req) => {
          const { origin, host } = req.headers;
          if (typeof origin === "string" && typeof host === "string" && origin === `http://${host}`) {
            proxyReq.setHeader("origin", publicOrigin);
          }
        });
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, REPO_ROOT, "");
  const rawBase = process.env.ALMANAC_BASE ?? env.ALMANAC_BASE ?? "/almanac/";
  // The router and the links all assume one trailing slash.
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  return {
    base,
    plugins: [react()],
    server: { port: 5177, strictPort: true, proxy: devProxy(env) },
    // `vite preview` serves the built app, behind the same proxy.
    preview: { port: 4177, strictPort: true, proxy: devProxy(env) },
  };
});
