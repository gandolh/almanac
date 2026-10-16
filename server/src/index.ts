import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { ConfigError, loadConfig, type Config } from "./config.js";

/** `src/` (tsx in dev) and `dist/` (built) sit at the same depth, so this resolves the same from both. */
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

try {
  process.loadEnvFile(`${REPO_ROOT}.env`);
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
}

let config: Config;
try {
  config = loadConfig(process.env);
} catch (err) {
  if (!(err instanceof ConfigError)) throw err;
  console.error(`Almanac cannot start:\n${err.message}`);
  process.exit(1);
}

// `npm run dev` runs the server from `server/`, so a relative DATA_DIR means the repo root's.
// `buildApp` opens `<dataDir>/almanac.db` there, creating the directory if needed.
const dataDir = isAbsolute(config.dataDir) ? config.dataDir : resolve(REPO_ROOT, config.dataDir);

const app = await buildApp({ ...config, dataDir }, { logger: true });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.close().then(
      () => process.exit(0),
      (err: unknown) => {
        app.log.error({ err }, `shutdown on ${signal} failed`);
        process.exit(1);
      },
    );
  });
}

try {
  await app.listen({ host: config.host, port: config.port });
} catch (err) {
  app.log.error({ err }, `Almanac cannot listen on ${config.host}:${config.port}`);
  process.exit(1);
}
