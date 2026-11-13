import { houseStyle } from "./vendor/house-style/eslint.config.js";

/**
 * The house config from the vendored house-style copy, given Almanac's folders. Thin on purpose: the
 * compiler is the first gate, and the house adds only what it cannot see. The rules and the reason
 * for each are in the copy.
 */
export default [
  ...houseStyle({
    root: import.meta.dirname,
    web: "web/src",
    // The one stylesheet (its @theme names the classes that exist); the class order is enforced.
    tailwind: { css: "web/src/styles/index.css", order: true },
    server: "server/src",
    // The docs capture helper, run by hand: it prints and reads the environment directly.
    scripts: ["scripts", "docs/images"],
    // Allowed to print: the server entry logs before its logger exists, and the seed and key CLIs talk
    // to the person running them.
    console: ["server/src/server.ts", "server/src/seed.ts", "server/src/vapid-keys.ts"],
    ignores: ["data/**"],
    // The browser tests: they get the test relaxations and the vitest rules leave them alone.
    playwright: ["web/e2e/**/*.ts"],
    // `expectError` is the tests' own assertion helper, so a test that calls it asserts.
    assertFunctionNames: ["expect", "expectTypeOf", "expectError"],
  }),
  {
    // The push-only service worker: plain JavaScript, run as a classic worker script.
    files: ["web/public/sw.js"],
    languageOptions: { sourceType: "script", globals: { self: "readonly", URL: "readonly" } },
  },
];
