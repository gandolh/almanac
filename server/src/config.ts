import { z } from "zod";
import { parseTrustedProxies, wardClientOptionsFromEnv, type WardClientOptions } from "../vendor/ward/ward-auth.js";

/** Where the auth plugin's routes will sit as Fastify sees them (`app.ts`, brief 02); the browser reaches them under the API prefix. */
export const AUTH_ROUTE_PREFIX = "/auth";

/** The Ward callback, under the API prefix: `WARD_OIDC_REDIRECT_URI` is the origin, the prefix, then this. */
export const WARD_CALLBACK_PATH = `${AUTH_ROUTE_PREFIX}/ward/callback`;

/** The server's settings, read once at startup from the environment (and the repo's `.env`). */
export interface Config {
  host: string;
  port: number;
  /** As given. `index.ts` resolves a relative path against the repo root. */
  dataDir: string;
  /** The app's own origin as the browser sees it, bare. Default is the Vite dev server. */
  publicOrigin: string;
  /** The API prefix as the browser sees it. Default `/almanac-api`. */
  apiPrefix: string;
  /** The web app's base path, with a trailing slash. Default `/almanac/` (the web build's `ALMANAC_BASE`). */
  webBase: string;
  /**
   * "Sign in with Ward": the five `WARD_OIDC_*` settings, or `undefined` when
   * `WARD_OIDC_ISSUER` is unset, and then the server has local accounts only
   * and the login page shows no Ward button. `clientKey` is a secret: never log it.
   */
  ward: WardClientOptions | undefined;
  /**
   * `AUTH_TRUSTED_PROXIES`, comma-separated: the peers besides loopback (addresses
   * or CIDR ranges) whose `X-Forwarded-For` the login lockout believes. Empty
   * means loopback only, which is right under the Vite dev proxy and for a
   * server on loopback. In a container it is the network the host's proxy
   * reaches it from, or every client shares one lockout.
   */
  trustedProxies: string[];
}

/** The environment cannot run the server. The message names every key at fault. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** An empty value (`KEY=` copied from `.env.example`) counts as not set. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const envSchema = z.object({
  HOST: optional(z.string()).transform((value) => value ?? "127.0.0.1"),
  PORT: optional(
    z.coerce.number<string>().int().min(1).max(65535, { message: "PORT must be a port number (1-65535)." }),
  ).transform((value) => value ?? 8809),
  DATA_DIR: optional(z.string()).transform((value) => value ?? "./data"),
  PUBLIC_ORIGIN: optional(
    z.string().refine((value) => URL.canParse(value) && new URL(value).origin === value, {
      message: "PUBLIC_ORIGIN must be a bare origin such as https://example.com: no path and no trailing slash.",
    }),
  ).transform((value) => value ?? "http://localhost:5177"),
  ALMANAC_API_PREFIX: optional(
    z.string().regex(/^\/[^\s?#]*[^/\s?#]$/, {
      message: "ALMANAC_API_PREFIX must be a path such as /almanac-api: a leading slash and no trailing slash.",
    }),
  ).transform((value) => value ?? "/almanac-api"),
  ALMANAC_BASE: optional(
    z.string().regex(/^\/([^\s?#]*\/)?$/, {
      message: "ALMANAC_BASE must be a path such as /almanac/: a leading and a trailing slash.",
    }),
  ).transform((value) => value ?? "/almanac/"),
});

function describe(issue: z.core.$ZodIssue): string {
  const key = String(issue.path[0] ?? "");
  return issue.message.startsWith(key) ? issue.message : `${key}: ${issue.message}`;
}

/**
 * The Ward settings, read by the library's own reader so the rules are its
 * (an empty `WARD_OIDC_ISSUER` means off; with it set, the client id, key and
 * redirect URI must be too). On top: the redirect URI must be the callback
 * under the API prefix, where the session cookie and the dev proxy are.
 * Messages never repeat the key.
 */
function wardSettings(env: NodeJS.ProcessEnv, apiPrefix: string | undefined, problems: string[]): WardClientOptions | undefined {
  let ward: WardClientOptions | undefined;
  try {
    ward = wardClientOptionsFromEnv(env);
  } catch (error) {
    problems.push(`${error instanceof Error ? error.message : String(error)}. Set all of them, or leave WARD_OIDC_ISSUER empty for local accounts only.`);
    return undefined;
  }
  if (ward === undefined || apiPrefix === undefined) return ward;
  const expected = `${apiPrefix}${WARD_CALLBACK_PATH}`;
  if (!URL.canParse(ward.redirectUri) || new URL(ward.redirectUri).pathname !== expected) {
    problems.push(`WARD_OIDC_REDIRECT_URI must be the callback as the browser reaches it: the app's origin, then ${expected}.`);
  }
  return ward;
}

/** `AUTH_TRUSTED_PROXIES` as a list, checked by the library's own parser (a malformed entry or a /0 is refused). */
function trustedProxies(value: string, problems: string[]): string[] {
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  try {
    parseTrustedProxies(entries);
  } catch (error) {
    problems.push(`AUTH_TRUSTED_PROXIES: ${error instanceof Error ? error.message : String(error)}.`);
  }
  return entries;
}

/** Parse and validate the environment. Throws `ConfigError` listing every problem; never exits. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  const problems = parsed.success ? [] : parsed.error.issues.map(describe);
  // Read on their own too, so one run names every key at fault.
  const apiPrefix = envSchema.shape.ALMANAC_API_PREFIX.safeParse(env.ALMANAC_API_PREFIX);
  const ward = wardSettings(env, apiPrefix.success ? apiPrefix.data : undefined, problems);
  const proxies = trustedProxies(env.AUTH_TRUSTED_PROXIES ?? "", problems);
  if (!parsed.success || problems.length > 0) {
    throw new ConfigError(problems.join("\n"));
  }
  const values = parsed.data;
  return {
    host: values.HOST,
    port: values.PORT,
    dataDir: values.DATA_DIR,
    publicOrigin: values.PUBLIC_ORIGIN,
    apiPrefix: values.ALMANAC_API_PREFIX,
    webBase: values.ALMANAC_BASE,
    ward,
    trustedProxies: proxies,
  };
}
