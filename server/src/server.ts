import closeWithGrace from "close-with-grace";
import { buildApp } from "./app.js";
import { ConfigError, loadConfig, loadEnvFile, resolveDataDir, type Config } from "./config.js";

// The process: settings, the app, shutdown, listen. Nothing else in the server listens.
const envFile = loadEnvFile();

let config: Config;
try {
  config = loadConfig();
} catch (err) {
  if (!(err instanceof ConfigError)) throw err;
  console.error(`Almanac cannot start:\n${err.message}`);
  process.exit(1);
}

const app = await buildApp(
  { ...config, dataDir: resolveDataDir(config.dataDir) },
  {
    server: {
      logger: true,
      // Loopback (the Vite dev proxy, a server on loopback) plus the proxy's network in a container,
      // so `request.ip` in the logs is the client. Ward's login lockout reads the socket itself.
      trustProxy: ["loopback", ...config.trustedProxies],
      // A socket silent this long mid-request is cut. No route waits: the push test's fan-out is the longest.
      connectionTimeout: 10_000,
      // The whole request, body included, must arrive within this.
      requestTimeout: 30_000,
      // Longer than the proxy keeps an idle upstream connection (Caddy's default: 2 minutes), so the
      // proxy never sends a request down a socket the server has just closed.
      keepAliveTimeout: 125_000,
    },
  },
);
app.log.info(envFile === undefined ? "no .env: settings from the environment" : `settings from ${envFile}`);

// SIGINT, SIGTERM, an uncaught error: stop taking requests, finish the ones in flight, run every
// onClose hook (the database closes there), and exit. After 10 s it exits anyway.
closeWithGrace({ delay: 10_000, logger: app.log }, async ({ signal, err }) => {
  if (err) app.log.error({ err }, "closing after an uncaught error");
  else app.log.info(`closing on ${signal ?? "request"}`);
  await app.close();
});

try {
  await app.listen({ host: config.host, port: config.port });
} catch (err) {
  app.log.error({ err }, `Almanac cannot listen on ${config.host}:${config.port}`);
  process.exit(1);
}
