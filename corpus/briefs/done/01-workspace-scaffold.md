# Task 01: Workspace scaffold

## Context

Almanac is a personal calendar ([overview](../../wiki/overview.md)). It copies
Shelfmark's layout (`../shelfmark`) file for file where it can: read
[architecture.md](../../wiki/architecture.md) first. This brief lays the
ground every later brief builds on: the three npm workspaces, the root
configs, a Fastify app with a health route, the SQLite opener with an empty
migration list, a Vite + React page, and the test setup. No auth, no
calendar code.

Depends on: nothing.

Fixed values (use exactly these everywhere):

| What | Value |
|---|---|
| Package names | `@almanac/shared`, `@almanac/server`, `@almanac/web` |
| Dev API port | `8809` (`PORT` in `.env`) |
| Vite dev / preview | `5177` / `4177`, `strictPort` |
| Production API port | `8797` (brief 12) |
| Web base | `/almanac/`, env `ALMANAC_BASE` |
| API prefix | `/almanac-api`, env `ALMANAC_API_PREFIX`; Vite proxies and strips it |
| Database | `<DATA_DIR>/almanac.db`, `DATA_DIR=./data` in dev |
| Node | `>=24`, exact versions (`.npmrc` `save-exact=true`) |

## Files you OWN

```
package.json  package-lock.json  .npmrc  .gitignore  .env.example
tsconfig.base.json  tsconfig.json  eslint.config.js  vitest.config.ts
shared/package.json  shared/tsconfig.json  shared/src/index.ts
server/package.json  server/tsconfig.json
server/src/index.ts  server/src/app.ts  server/src/config.ts  server/src/errors.ts
server/src/db/open.ts  server/src/db/migrations.ts
server/src/testing/testApp.ts
server/src/*.test.ts  server/src/db/*.test.ts
web/package.json  web/tsconfig.json  web/vite.config.ts  web/index.html
web/src/main.tsx  web/src/App.tsx  web/src/base.ts
```

## Files you must NOT touch

`corpus/` (except moving nothing; the controller closes briefs). Nothing in
`../shelfmark`; read it, never edit it.

## What to do

1. Copy Shelfmark's root files and adapt names, ports and env keys:
   `package.json` (same scripts, minus `dev:https`), `.npmrc`, `.gitignore`
   (drop the `.impeccable` line), `tsconfig.base.json`, `tsconfig.json`,
   `eslint.config.js`, `vitest.config.ts` (keep `pool: "forks"`).
   Same dev dependency versions as Shelfmark.
2. `.env.example`: `HOST=127.0.0.1`, `PORT=8809`, `DATA_DIR=./data`,
   `PUBLIC_ORIGIN=`, commented `# ALMANAC_API_PREFIX`, `# ALMANAC_BASE`,
   `SEED_USERNAME=`, `SEED_PASSWORD=`, `AUTH_TRUSTED_PROXIES=`, and the five
   `WARD_OIDC_*` keys, all empty. No Google Books key.
3. `shared`: copy Shelfmark's package and tsconfig. `src/index.ts` exports
   `APP_NAME = "Almanac"` only for now. Dependency `zod` at Shelfmark's version.
4. `server`: copy Shelfmark's `package.json` (fastify, better-sqlite3, zod,
   tsx, @types/better-sqlite3 at the same versions; keep the `seed` script
   even though `src/seed.ts` comes in brief 02), `tsconfig.json`,
   `src/index.ts`, `src/errors.ts`, `src/db/open.ts` (file name `almanac.db`),
   `src/db/migrations.ts` (an empty, append-only array with the same runner
   and the "database is newer than the server" guard).
   `src/config.ts`: Shelfmark's loader without the Google Books key; keep the
   Ward keys and trusted proxies parsing because brief 02 needs them, but
   `app.ts` must not use them yet.
   `src/app.ts`: `buildApp(config, { logger })` with the JSON parser, error
   handling, `GET /api/health` returning `{ status: "ok" }`, and an empty
   `FEATURES` list with a `FeatureContext { config, db }` that later briefs
   extend.
   `src/testing/testApp.ts`: `startTestApp(envOverrides)` with a temp
   `DATA_DIR`. Brief 02 adds `signIn` and `startSignedInApp`.
5. `web`: copy Shelfmark's `package.json` minus the scanner, table, PWA,
   Excel and SSL packages (keep react, react-dom, vite, @vitejs/plugin-react,
   the React types, `@almanac/shared`). `vite.config.ts`: base from
   `ALMANAC_BASE`, env loaded from the repo root, proxy `/almanac-api` to
   `127.0.0.1:${PORT||8809}` with the prefix stripped and the same `Origin`
   rewrite, port 5177, preview 4177, no PWA plugin, no SSL.
   `src/base.ts`: `appBase()` and `API_BASE = "/almanac-api"`.
   `App.tsx` renders the app name and the result of `GET /api/health`.
6. Tests: config parsing (good env, bad port, empty value treated as unset),
   the health route through `startTestApp`, migrations on a fresh database.
7. `npm install` and commit nothing; the controller commits.

## Acceptance

- `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass.
- `npm run dev` serves the page at `http://localhost:5177/almanac/` and it
  shows the health result through the proxy.
- `git status` shows every new file tracked-able (nothing source-like ignored).

## Outcome

_2026-10-16_. Built as specified; 22 tests, typecheck, lint and build clean,
and the dev proxy served `/almanac/` and `/almanac-api/api/health`. Two
departures: `server/vendor/ward/` was copied here already, because the kept
Ward and trusted-proxy parsing in `config.ts` imports it (brief 02 only
verifies it and adds the web copy); `ERROR_STATUS` gained `unauthorized: 401`
for brief 02's `currentUserId` and lost Shelfmark's `upstream: 502`. Health
answers `{ status: "ok" }`.
