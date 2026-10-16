import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config.js";

function problems(env: NodeJS.ProcessEnv): string {
  try {
    loadConfig(env);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return (error as ConfigError).message;
  }
  throw new Error("expected loadConfig to throw");
}

describe("loadConfig", () => {
  it("defaults every setting", () => {
    expect(loadConfig({})).toEqual({
      host: "127.0.0.1",
      port: 8809,
      dataDir: "./data",
      publicOrigin: "http://localhost:5177",
      apiPrefix: "/almanac-api",
      webBase: "/almanac/",
      ward: undefined,
      trustedProxies: [],
    });
  });

  it("reads the overrides, and treats an empty value as unset", () => {
    const config = loadConfig({ HOST: "0.0.0.0", PORT: "8796", DATA_DIR: "/data", ALMANAC_BASE: "" });
    expect(config).toMatchObject({ host: "0.0.0.0", port: 8796, dataDir: "/data", webBase: "/almanac/" });
    expect(loadConfig({ DATA_DIR: "" }).dataDir).toBe("./data");
  });

  it("names every key at fault", () => {
    const message = problems({ PORT: "70000", ALMANAC_API_PREFIX: "/almanac-api/", PUBLIC_ORIGIN: "https://example.com/" });
    expect(message).toContain("PORT");
    expect(message).toContain("ALMANAC_API_PREFIX");
    expect(message).toContain("PUBLIC_ORIGIN");
  });

  it("wants a base with both slashes", () => {
    expect(problems({ ALMANAC_BASE: "/almanac" })).toContain("ALMANAC_BASE");
  });

  describe("Sign in with Ward", () => {
    // What Ward's local seed writes. The key is a stand-in: the config never reads it, `createWardClient` does.
    const WARD = {
      WARD_OIDC_ISSUER: "http://localhost:8792/ward-api/oidc",
      WARD_OIDC_CLIENT_ID: "almanac",
      WARD_OIDC_CLIENT_KEY: "not-a-real-key",
      WARD_OIDC_REDIRECT_URI: "http://localhost:5177/almanac-api/auth/ward/callback",
      WARD_OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:5177/almanac/",
    };

    it("is on with the five settings", () => {
      expect(loadConfig(WARD).ward).toEqual({
        issuer: "http://localhost:8792/ward-api/oidc",
        clientId: "almanac",
        clientKey: "not-a-real-key",
        redirectUri: "http://localhost:5177/almanac-api/auth/ward/callback",
        postLogoutRedirectUri: "http://localhost:5177/almanac/",
      });
    });

    it("is off with WARD_OIDC_ISSUER empty, whatever else is set", () => {
      expect(loadConfig({ ...WARD, WARD_OIDC_ISSUER: "" }).ward).toBeUndefined();
    });

    it("names what is missing when the issuer is set, and never repeats the key", () => {
      const message = problems({ ...WARD, WARD_OIDC_CLIENT_ID: "", WARD_OIDC_REDIRECT_URI: "" });
      expect(message).toContain("WARD_OIDC_CLIENT_ID");
      expect(message).toContain("WARD_OIDC_REDIRECT_URI");
      expect(message).not.toContain("not-a-real-key");
    });

    it("wants the callback under the API prefix", () => {
      const elsewhere = problems({ ...WARD, WARD_OIDC_REDIRECT_URI: "http://localhost:5177/almanac/auth/ward/callback" });
      expect(elsewhere).toContain("WARD_OIDC_REDIRECT_URI");
      expect(elsewhere).toContain("/almanac-api/auth/ward/callback");
      const prefix = { ALMANAC_API_PREFIX: "/calendar-api", WARD_OIDC_REDIRECT_URI: "https://example.com/calendar-api/auth/ward/callback" };
      expect(loadConfig({ ...WARD, ...prefix }).ward?.redirectUri).toBe(prefix.WARD_OIDC_REDIRECT_URI);
    });
  });

  describe("AUTH_TRUSTED_PROXIES", () => {
    it("reads a comma-separated list of addresses and ranges", () => {
      expect(loadConfig({ AUTH_TRUSTED_PROXIES: " 172.16.0.0/12, 10.0.0.2 ,fd00::/8," }).trustedProxies).toEqual([
        "172.16.0.0/12",
        "10.0.0.2",
        "fd00::/8",
      ]);
    });

    it.each(["0.0.0.0/0", "172.19.0.3/16", "caddy"])("refuses %s", (value) => {
      expect(problems({ AUTH_TRUSTED_PROXIES: value })).toContain("AUTH_TRUSTED_PROXIES");
    });
  });

  it("names the Ward and proxy keys along with the rest", () => {
    const message = problems({ PORT: "0", AUTH_TRUSTED_PROXIES: "0.0.0.0/0", WARD_OIDC_ISSUER: "http://localhost:8792/ward-api/oidc" });
    expect(message).toContain("PORT");
    expect(message).toContain("AUTH_TRUSTED_PROXIES");
    expect(message).toContain("WARD_OIDC_CLIENT_ID");
  });
});
