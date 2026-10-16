import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { startTestApp, type TestApp } from "./testing/testApp.js";

/**
 * `npm run seed` itself, as the owner runs it: a child process through tsx,
 * with the values in its environment and no terminal (stdin is a pipe). The
 * passwords are made up per test.
 */

const SERVER_DIR = fileURLToPath(new URL("../", import.meta.url));

interface Run {
  code: number | null;
  output: string;
}

function seed(env: NodeJS.ProcessEnv): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/seed.ts"], {
      cwd: SERVER_DIR,
      // Empty values are "set", so a developer's own .env can't fill them in.
      env: { PATH: process.env.PATH, SEED_USERNAME: "", SEED_PASSWORD: "", ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stdin.end();
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
}

let dataDir: string | undefined;
let t: TestApp | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  dataDir = undefined;
});

async function login(username: string, password: string): Promise<number> {
  t ??= await startTestApp({ DATA_DIR: dataDir });
  return (await t.app.inject({ method: "POST", url: "/auth/login", payload: { username, password } })).statusCode;
}

describe("npm run seed", () => {
  it("creates the user from SEED_USERNAME and SEED_PASSWORD, who can then sign in", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "almanac-seed-"));
    const password = randomBytes(12).toString("base64url");
    const run = await seed({ DATA_DIR: dataDir, SEED_USERNAME: "reader", SEED_PASSWORD: password });
    expect(run).toEqual({ code: 0, output: "Created reader.\n" });
    expect(await login("reader", password)).toBe(200);
  });

  it("leaves an existing user exactly as it is, password included", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "almanac-seed-"));
    const first = randomBytes(12).toString("base64url");
    const second = randomBytes(12).toString("base64url");
    await seed({ DATA_DIR: dataDir, SEED_USERNAME: "reader", SEED_PASSWORD: first });
    const again = await seed({ DATA_DIR: dataDir, SEED_USERNAME: "Reader", SEED_PASSWORD: second });
    expect(again).toEqual({ code: 0, output: "Reader already exists; left as it was.\n" });
    expect(await login("reader", first)).toBe(200);
    expect(await login("reader", second)).toBe(401);
  });

  it("asks for nothing without a terminal: it says what to set and creates nobody", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "almanac-seed-"));
    const run = await seed({ DATA_DIR: dataDir, SEED_USERNAME: "reader" });
    expect(run.code).toBe(1);
    expect(run.output).toContain("Set SEED_USERNAME and SEED_PASSWORD");
  });

  it("refuses a short password with the library's reason", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "almanac-seed-"));
    const run = await seed({ DATA_DIR: dataDir, SEED_USERNAME: "reader", SEED_PASSWORD: "short" });
    expect(run.code).toBe(1);
    expect(run.output).toContain("at least 8 characters");
    expect(run.output).not.toContain("short\n");
  });
});
