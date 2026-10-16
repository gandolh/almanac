import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { loadConfig, type Config } from "../config.js";

/**
 * A whole app for tests, on a fresh temporary `DATA_DIR` so route tests never
 * touch `data/`. The overrides are environment values, as `loadConfig` reads them.
 *
 *     const t = await startTestApp();
 *     const res = await t.app.inject({ method: "GET", url: "/api/health" });
 *     await t.close();
 *
 * `close` stops the app and deletes the directory. Brief 02 adds `signIn` and
 * `startSignedInApp` here.
 */

export interface TestApp {
  app: FastifyInstance;
  config: Config;
  /** The temporary data directory. */
  dataDir: string;
  close(): Promise<void>;
}

export async function startTestApp(overrides: NodeJS.ProcessEnv = {}): Promise<TestApp> {
  const dataDir = await mkdtemp(join(tmpdir(), "almanac-test-"));
  try {
    const config = loadConfig({ DATA_DIR: dataDir, ...overrides });
    const app = await buildApp(config);
    return {
      app,
      config,
      dataDir,
      async close() {
        await app.close();
        await rm(dataDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(dataDir, { recursive: true, force: true });
    throw error;
  }
}
