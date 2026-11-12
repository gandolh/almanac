# Task 04: The server in the house code structure

**Depends on:**

- In Almanac: brief 01, for the gate, `eslint-plugin-n`'s `no-process-env` (a warning until this brief) and `.claude/rules/server.md`.
- In the owner's skills library:
  - brief 03, *A code-structure skill for the Fastify + React apps*: rules 1-11, the `server-skeleton.md` reference, `zod-type-provider.md`, `migrating-a-server.md`, `check-structure.mjs`, and the dependency-cruiser and knip presets;
  - brief 16, *The Fastify servers adopt the code structure*: Almanac's row and the method;
  - brief 15, *Enforce the base-ui and code-structure skills in every repo*: `check-structure` runs `--warn-only` until this brief is done.
- The owner's grilling of 2026-11-10:
  - Q1 (how services start: the Dockerfile's `CMD`);
  - Q23 (`server/src/features/`), Q24 (plugin options, explicit registration), Q25 (response schemas everywhere), Q27 (the test runner);
  - Q43 (the error handler), Q53 (streams exempt), Q55 (where a schema lives), Q56 (`ApiError`, no decorator seam).

**Order:** after 01. It touches no file that 02 or 03 touch except `package-lock.json`, so it may run before them, but never at the same time as either.

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

> **Update 2026-11-11:** dependency-cruiser landed in brief 01. `.dependency-cruiser.cjs` exists and `check:conventions` runs `depcruise` already, with `no-circular` lowered to a warning (the route files import `FeatureContext` from `app.ts`; 7 cycles). This brief keeps the cross-feature check, drops the `no-circular` override once each feature has its own options type, and drops `check-structure`'s `--warn-only` and the `n/no-process-env` warning block in `eslint.config.js`.

## Context

The owner asked on 2026-11-09 for one researched code structure, enforced in every repo. Almanac's server is already near it:

- `buildApp(config)` in `server/src/app.ts` never listens;
- `server/src/config.ts` parses the environment once with zod;
- features get a typed `FeatureContext` as plugin options and are registered by name;
- errors go through one handler;
- 11 test files drive the app with `inject()`.

What is missing:

- the `server.ts` name;
- three stray readers of the environment;
- feature folders;
- route schemas, response schemas above all;
- `fastify-plugin` on the cross-cutting plugins;
- `close-with-grace`, timeouts and `trustProxy`.

### The versions (verified 2026-11-09)

- **zod 4.5.4** in `shared/package.json`, `server/package.json` and the root `overrides`, with a single copy in `package-lock.json`. `@fastify/type-provider-zod` 1.0.3 needs `>=4.2.0`, so **no zod move**.
- **fastify 5.12.7**; the latest is 5.12.8, and the provider needs `^5.5.0`.
- **`@fastify/type-provider-zod` 1.0.3:**
  - at run time it imports only `@fastify/error` and `zod/v4/core`;
  - it also declares `@fastify/swagger >=9.5.1` and `openapi-types ^12.1.3` as peers, not optional, so npm will install them. That is type-only weight, and the lockfile diff shows it.
  - `fastify-plugin` 6.0.1 and `close-with-grace` 2.5.0 are the other new dependencies.

### A trap in the shared schemas (found 2026-11-09)

The provider's serializer calls zod's `safeEncode`, and **zod throws when encoding through a `.transform()`**. Run against zod 4.5.4, the message is "Encountered unidirectional transform during encode: ZodTransform".

`shared/src/event.ts:55-69`'s `repeatSchema` sorts `byDay` with a `.transform()` (line 61), and `occurrenceSchema` (253-271) includes it as `repeat`. So `occurrenceSchema` as a response schema would turn every reply holding a weekly series with chosen days into a 500. That covers `GET /api/occurrences`, `GET /api/search`, `POST` and `PATCH /api/events`.

The fix is a transform-free output shape:

- a stored `repeat` schema, the same object without the `.transform()`, used by `occurrenceSchema`;
- while the input schemas keep the sorting `repeatSchema`.

The other transforms (`instantSchema`, `eventInputSchema`'s `settleTimes`, `queryInstant`'s `z.preprocess`) sit only in input schemas, which are decoded, and decoding is fine.

### The move map: every file under `server/src/` (55: 32 source, 23 tests)

A bare file name in the table sits at the root of `server/src/`; every other path is given from the repo root.

| Today | Lines | Target | Note |
|---|---|---|---|
| `index.ts` | 47 | `server.ts` | The entry: config → `buildApp` → `listen`, `close-with-grace`. The `.env` read and the data-dir rule move to `config.ts`. |
| `app.ts`, `app.test.ts` | 198, 29 | the same | Keeps `buildApp`, `FeatureContext`, `Feature` and `FEATURES`. `signIn` (63-96) moves to `server/src/plugins/auth/index.ts`, the empty-body JSON parser (165-177) to `server/src/plugins/json-body.ts`, the health route (181) to `server/src/features/health/routes.ts`, and `startReminders` (128-145) to `server/src/features/reminders/index.ts`. |
| `config.ts`, `config.test.ts` | 230, 156 | the same | Gains `loadEnvFile()` (from `index.ts:9-13` and `seed.ts`'s copy), `resolveDataDir()` (`index.ts:26`, `seed.ts:68-69`) and `loadSeedConfig()` (`seed.ts:61-62`). `loadConfig()` keeps its `env = process.env` default. |
| `errors.ts` | 91 | `server/src/lib/api-error.ts` + `server/src/plugins/errors.ts` | `ApiError`, `ERROR_STATUS`, `ErrorCode`, `ErrorBody` and `errorBody` go to `server/src/lib/`, with no Fastify import. The stores throw them. `sendError` and the handlers go to the plugin. |
| `server/src/auth/accounts.ts`, `.test.ts` | 32, 59 | `server/src/plugins/auth/accounts.ts`, `.test.ts` | |
| `server/src/auth/guard.ts`, `.test.ts` | 80, 48 | `server/src/plugins/auth/guard.ts`, `.test.ts` | `currentUserId` and `registerOriginGuard`. Features import `currentUserId` from here. |
| `server/src/auth/auth.test.ts` | 286 | `server/src/plugins/auth/auth.test.ts` | |
| (new) | | `server/src/plugins/auth/index.ts` | `signIn`, wrapped in `fastify-plugin` so `wardAuth` and the origin guard stay root hooks. |
| (new) | | `server/src/plugins/json-body.ts` | The empty-body JSON parser, wrapped in `fastify-plugin`. |
| `server/src/db/open.ts` | 53 | the same | |
| `server/src/db/migrations.ts`, `.test.ts` | 138, 161 | the same | |
| `server/src/push/push.ts` | 71 | `server/src/features/push/service.ts` | `createPushService`. `app.ts` builds it into the context, and reminders use it. |
| `server/src/push/sender.ts` | 44 | `server/src/features/push/sender.ts` | |
| `server/src/push/env-file.ts`, `.test.ts` | 39, 36 | `server/src/lib/env-file.ts`, `.test.ts` | Pure. Only `vapid-keys.ts` uses it. |
| `server/src/routes/push.ts`, `.test.ts` | 59, 162 | `server/src/features/push/routes.ts`, `.test.ts` | |
| `server/src/store/push-subscriptions.ts`, `.test.ts` | 97, 116 | `server/src/features/push/store.ts`, `.test.ts` | |
| `server/src/recurrence/expand.ts`, `.test.ts` | 311, 325 | `server/src/features/events/expand.ts`, `.test.ts` | Pure apart from type imports from the events store. Brief 16's "`server/src/recurrence/` is pure" holds for this file, not for `scopes.ts`. Gains `seriesRepeats` from `server/src/routes/occurrences.ts`. |
| `server/src/recurrence/scopes.ts`, `.test.ts` | 567, 765 | `server/src/features/events/service.ts`, `service.test.ts` | The edit scopes and `removeCalendar`. Over rule 11's 400 lines: a warning to leave, since nothing is added here. |
| `server/src/routes/events.ts`, `.test.ts` | 63, 370 | `server/src/features/events/routes.ts`, `.test.ts` | |
| `server/src/store/events.ts`, `.test.ts` | 367, 282 | `server/src/features/events/store.ts`, `.test.ts` | |
| `server/src/store/search-text.ts`, `.test.ts` | 13, 19 | `server/src/features/events/search-text.ts`, `.test.ts` | Only the events store imports it. |
| (new) | | `server/src/features/events/index.ts` | What other features may use: the store's factory and types, `expandSeries`, `isSeries`, `rowOccurrence`, `searchOccurrence`, `seriesRepeat`, `seriesRepeats`, `removeCalendar`. |
| `server/src/routes/occurrences.ts`, `.test.ts` | 71, 237 | `server/src/features/occurrences/routes.ts`, `.test.ts` | |
| `server/src/routes/search.ts`, `.test.ts` | 65, 171 | `server/src/features/search/routes.ts`, `.test.ts` | It imports `seriesRepeats` from `./occurrences.js` today (line 14), one feature reaching into another. Afterwards it comes from `../events/index.js`. |
| `server/src/routes/calendars.ts`, `.test.ts` | 55, 216 | `server/src/features/calendars/routes.ts`, `.test.ts` | |
| `server/src/store/calendars.ts`, `.test.ts` | 131, 140 | `server/src/features/calendars/store.ts`, `.test.ts` | |
| `server/src/routes/settings.ts`, `.test.ts` | 14, 45 | `server/src/features/settings/routes.ts`, `.test.ts` | |
| `server/src/store/settings.ts`, `.test.ts` | 31, 46 | `server/src/features/settings/store.ts`, `.test.ts` | |
| `server/src/reminders/due.ts`, `message.ts`, `sent-log.ts` | 99, 46, 30 | `server/src/features/reminders/` (same names) | `sent-log.ts` is the feature's one table. |
| `server/src/reminders/timer.ts`, `timer.test.ts`, `reminders.test.ts` | 104, 59, 398 | `server/src/features/reminders/` (same names) | |
| (new) | | `server/src/features/reminders/index.ts` | `startReminders`, from `app.ts`. |
| (new) | | `server/src/features/health/routes.ts` | `GET /api/health`. |
| `seed.ts`, `seed.test.ts` | 83, 88 | the same, at the `src/` root | A CLI. The container runs `node server/dist/seed.js` (`docs/owner-setup.md:110`). Its environment reads move to `config.ts`. |
| `vapid-keys.ts` | 64 | the same | A CLI (`npm run vapid-keys`). |
| `server/src/testing/testApp.ts`, `server/src/testing/vapid.ts` | 166, 22 | the same | Keeps `startTestApp` and `signInAs` (decision 7). |

**Feature boundaries after the move** (rule 5: only through `index.ts`):

- occurrences, search, calendars and reminders import from `server/src/features/events/index.ts`;
- reminders also use settings and push, through their `index.ts`.

One cycle to avoid: `removeCalendar` (today `scopes.ts:557`) takes a `CalendarStore`, and calendars import it. Give it the structural `{ remove(userId: string, id: number): boolean }` it uses instead of the type. Then `server/src/features/events/` never imports `server/src/features/calendars/`.

Every file one folder deeper needs its relative imports updated, the vendored Ward library included: `server/vendor/ward/ward-auth.js`, imported today as `../vendor/…` and `../../vendor/…`. The Dockerfile copies `server/vendor` next to `server/dist`, so `dist/` mirrors `src/` depth and the image needs no change for it.

### Every reader of the environment

| Where | What | Afterwards |
|---|---|---|
| `config.ts:206` | `loadConfig(env = process.env)` | stays, the one reader |
| `index.ts:17` | `loadConfig(process.env)` | `server.ts` calls `loadConfig()` |
| `index.ts:9-13`, and `seed.ts`'s copy | `process.loadEnvFile(<repo>/.env)` | `loadEnvFile()` in `config.ts` |
| `seed.ts:61` | `SEED_USERNAME` | `loadSeedConfig()` in `config.ts` |
| `seed.ts:62` | `SEED_PASSWORD` | the same |
| `seed.ts:68` | `DATA_DIR`, with its own `"./data"` default | `resolveDataDir()`, one rule shared with the server |
| `seed.test.ts` | sets the environment | a test, excepted |
| outside `server/` | `web/vite.config.ts:42` (`ALMANAC_BASE`), `docs/images/demo-seed.mjs` | out of scope: a build config and a doc script |

No file reads `NODE_ENV`. The Dockerfile sets `NODE_ENV=production`, which only Fastify's dependencies may read.

### Every route: 16, by feature, each with its schemas from `shared/`

The vendored `wardAuth` plugin's `/auth/*` routes are generated code and out of scope.

| Feature | Method and path | params | querystring | body | response |
|---|---|---|---|---|---|
| health (1) | `GET /api/health` | | | | `200`: **new** `healthSchema` (`{ status: "ok" }`), in `server/src/features/health/` |
| calendars (4) | `GET /api/calendars` | | | | `200`: `calendarListSchema` |
| | `POST /api/calendars` | | | `calendarCreateSchema` | `201`: `calendarSchema` |
| | `PATCH /api/calendars/:id` | **new** `idParamsSchema`, in `server/src/lib/` | | `calendarPatchSchema` | `200`: `calendarSchema` |
| | `DELETE /api/calendars/:id` | `idParamsSchema` | | | `204` |
| events (3) | `POST /api/events` | | | `eventInputSchema` | `201`: `occurrenceSchema` (output-safe) |
| | `PATCH /api/events/:id` | `idParamsSchema` | | `eventPatchSchema` | `200`: `occurrenceSchema` |
| | `DELETE /api/events/:id` | `idParamsSchema` | `eventDeleteQuerySchema` | | `204` |
| occurrences (1) | `GET /api/occurrences` | | `occurrenceQuerySchema` | | `200`: `occurrenceListSchema` |
| search (1) | `GET /api/search` | | `searchQuerySchema` | | `200`: `searchResponseSchema` |
| settings (2) | `GET /api/settings` | | | | `200`: `settingsSchema` |
| | `PATCH /api/settings` | | | `settingsPatchSchema` | `200`: `settingsSchema` |
| push (4) | `GET /api/push/key` | | | | `200`: `pushKeySchema` |
| | `PUT /api/push/subscriptions` | | | `pushSubscriptionInputSchema` | `204` |
| | `DELETE /api/push/subscriptions` | | | `pushSubscriptionDeleteSchema` | `204` |
| | `POST /api/push/test` | | | | `200`: `pushTestResultSchema` |

**`idParamsSchema` stays a plain `{ id: string }`.** The handlers keep `calendarId()` and `eventId()`, which answer a non-numeric id with 404 `not_found`, as `calendars.test.ts:99` expects. A regex in the schema would turn that into a 400.

**Hand parsing removed:** 10 calls of `.parse()` on request input in 6 files:

- `settings.ts:12`;
- `push.ts:36, 44`;
- `search.ts:38`;
- `occurrences.ts:49`;
- `events.ts:43, 52, 59`;
- `calendars.ts:37, 45`.

`scopes.ts:173` parses a merged patch, not request input, and stays.

### The error plugin

`server/src/plugins/errors.ts`, wrapped in `fastify-plugin` and registered first. It **keeps Almanac's body, `{ error: { code, message } }`**, because `web/src/api.ts:141-156` parses exactly that (decision 4). The handler, in order:

1. `ApiError` → its code.
2. `hasZodFastifySchemaValidationErrors(error)` → 400 `validation`.
   - The message is the first issue's path and message, as `describeIssue` builds today: `instancePath` `/changes/title` becomes `changes.title: …`, and `/` becomes the message alone.
   - The tests that match messages must pass unchanged: `events.test.ts:155-158, 342, 345, 368`, `calendars.test.ts:81`, `scopes.test.ts:167, 724, 735`.
3. A `z.core.$ZodError` → 400 `validation`, for the parse left in the service.
4. `isResponseSerializationError(error)` → 500 `internal`, logged with the method and URL. Never shown to the client.
5. A 4xx Fastify raised → its status, as today.
6. Anything else → 500 `internal`, logged, no detail to the client.

The 404 handler stays. It isn't rate-limited: `@fastify/rate-limit` is not a dependency, and rule 8 asks for it only where it is present.

### The `server.ts` / `app.ts` split, and the entry file

`server.ts`:

1. `loadEnvFile()` and `loadConfig()`. A `ConfigError` goes to stderr and the process exits 1, before any logger exists.
2. `buildApp(config, { logger: true, server: { connectionTimeout, requestTimeout, keepAliveTimeout, trustProxy } })`. `BuildAppOptions` gains `server`, passed to `Fastify()`.
3. `close-with-grace`, in place of the two signal handlers.
4. `listen({ host, port })`.

`app.ts` registers in a fixed order:

1. the errors plugin;
2. the JSON body plugin;
3. the provider's compilers (`setValidatorCompiler`, `setSerializerCompiler`);
4. `server/src/plugins/auth` (still first among everything with routes);
5. then `FEATURES`: health, calendars, events, occurrences, search, settings, push;
6. then reminders.

The `.js` import suffixes stay.

**Renaming the entry moves the built file** from `server/dist/index.js` to `server/dist/server.js`. These name it in this repo:

- `infrastructure/Dockerfile:112`: `CMD ["node", "server/dist/index.js"]`;
- the root `package.json:18`: `start`;
- `server/package.json`:
  - `main` (line 7);
  - `dev` (`tsx watch src/index.ts`, line 10);
  - `start` (line 11);
  - `exports["."]` (lines 30-33).

No code imports `@almanac/server` by any of its `exports`. Point them at the new paths, or drop them if knip (brief 01) calls them unused, and record which.

The container starts that file path, so the `CMD` is the one place that names it (Q1; decision 5).

### Test impact

- 23 test files with 370 `it`/`test` calls, on vitest with `pool: "forks"` (`vitest.config.ts`, include `*/src/**/*.test.{ts,tsx}`, which still matches nested folders).
- 12 files build the app through `startTestApp`, and 11 call `inject()`.
- Moved tests need their relative imports updated: 11 import `../db/open.js`, 10 `../testing/testApp.js`, 4 `../store/events.js` and 3 `../errors.js`.
- No test changes its assertions, apart from what decision 4's messages already keep.
- New tests:
  - a weekly series with `byDay` round-trips through `GET /api/occurrences`, `GET /api/search`, `POST` and `PATCH /api/events` (the trap above);
  - an extra field on a store row is stripped from a reply;
  - a reply that fails its response schema is a 500 `internal` with no detail;
  - the health route.

## Owner decisions

All decided 2026-11-10 as technical calls (the owner may overrule); the numbers are the skills library's open questions.

1. **`server/src/features/<name>/`** (Q23). As in the move map.
2. **Typed plugin options and explicit registration** (Q24). Keep `FeatureContext` and `FEATURES`, which Almanac already has. Decorators only for request-scoped values; there are none yet, since `currentUserId(request)` reads the session. No decorators as a test seam (Q56): tests pass dependencies as plugin options, as `startTestApp` does.
3. **A response schema on every route** (Q25). No Almanac route sends pass-through JSON, and none streams or serves binary, so nothing needs a `conventions.json` exemption (Q53).
4. **The error handler** (Q43). One handler, keeping Almanac's body shape `{ error: { code, message } }`, which `web/src/api.ts` parses. It passes Fastify's own 4xx through and never echoes a thrown message to the client. One `ApiError` class stays (Q56).
5. **The entry file and the deploy** (Q1, fact). Services run in a container built from `infrastructure/Dockerfile`, which starts a file path. Rename `index.ts` to `server.ts`, and change the Dockerfile's `CMD`, the scripts and `exports` in the same commit. The repo owns that file, and the build runs `npm ci` and `tsc -b` only, so there is no vps-deploy edit and the deploy is left alone.
6. **The test runner** (Q27). vitest stays (only atrium stays on `node:test`). Shelfmark's "nothing boots the app" (Q26) doesn't apply: Almanac's decisions allow `inject()`.
7. **The test helper's name.** Keep `server/src/testing/testApp.ts` and `startTestApp`. Renaming to the skill's `buildTestApp` would touch 12 files for nothing. Record it in `conventions.json` if the checker looks for the name.
8. **Where a schema lives** (Q55). In `shared/` when the web imports it, otherwise in its feature folder. So `healthSchema` goes in `server/src/features/health/`, `idParamsSchema` (used by two features) in `server/src/lib/`, and the stored repeat in `shared/` beside `occurrenceSchema`.
9. **The checkers read the roots from `conventions.json`** (technical call): `server/src` and `shared/src` here. Config read at import time is allowed.
10. **Timeouts and proxy.** Defaults, still open for the owner:
    - `connectionTimeout: 10_000`;
    - `requestTimeout: 30_000`; no route runs long, and the push test's fan-out is the longest;
    - `keepAliveTimeout: 125_000`, above Caddy's default two-minute idle keep-alive to its upstreams, so the API never closes a connection Caddy is about to reuse. Check the deploy's Caddy snippet for its own `keepalive`.
    - `trustProxy`: loopback plus `AUTH_TRUSTED_PROXIES`, one list, so `request.ip` in logs is the client. Ward's login lockout reads the socket itself (`server/vendor/ward/ward-auth.js:4884`), so this doesn't change it.
11. **Logging.** Default: JSON as today, no `pino-pretty`.
12. **Fastify 5.12.8.** Default: not in this brief.

## Files you OWN

- `server/src/**`: the moves, the new plugins, the schemas wired in.
- `server/package.json` (scripts, `main`, `exports`, the new dependencies pinned) and `package-lock.json`.
- `shared/src/**`, only to add the transform-free stored repeat used by `occurrenceSchema`, with its test. Input schemas don't change. `healthSchema` and `idParamsSchema` are server-side (decision 8).
- `infrastructure/Dockerfile`: the `CMD` line.
- The root `package.json`: `start`, and `check:conventions` (dependency-cruiser added, `check-structure`'s `--warn-only` dropped).
- `.dependency-cruiser.cjs` (new, from the skill's preset).
- `eslint.config.js`: `eslint-plugin-n`'s `no-process-env`, from warning to error.
- `scripts/conventions.json`, for any exception from decision 7 (and the roots, decision 9).
- `.claude/rules/server.md`: the structure lines.
- `docs/architecture.md:64-65`: its links to `server/src/recurrence/` and `server/src/routes/`.
- Corpus:
  - [wiki/architecture.md](../../wiki/architecture.md): the layout, lines 43 and 88;
  - [wiki/data-model.md](../../wiki/data-model.md): line 49;
  - [wiki/notifications.md](../../wiki/notifications.md): lines 72 and 85;
  - [wiki/recurrence.md](../../wiki/recurrence.md): line 8;
  - [wiki/decisions.md](../../wiki/decisions.md): below;
  - [wiki/status.md](../../wiki/status.md);
  - [log.md](../../log.md).

## Files you must NOT touch

- `web/`. A response schema that drops a field the web reads is a finding: fix the schema, not the web.
- `shared/` input schemas and their behaviour.
- `server/vendor/`: generated.
- The deploy beyond the Dockerfile's `CMD` line. There is no vps-deploy edit (decision 5).
- Behaviour: status codes, error codes and messages, and every route's JSON apart from fields the comparison shows were leaks.

## What to do

Follow `migrating-a-server.md`. One commit per step; after each, `npm run check` and `npm run build` pass, and `npm start` serves `GET /api/health`.

1. **Before.**
   - Run `check-structure` strict and record its counts by rule.
   - Seed a scratch `DATA_DIR` with `docs/images/demo-seed.mjs` ([docs/images/shots.md](../../../docs/images/shots.md)).
   - Save the JSON of every route above, signed in as the demo user, with fixed query ranges. Include a weekly series with chosen days.
2. **`config.ts` and the split.** The three new helpers in `config.ts`. `seed.ts` uses them. `index.ts` becomes `server.ts`, with the entry-file changes (decision 5), `close-with-grace`, the timeouts and `trustProxy`. `no-process-env` (from `eslint-plugin-n`) now finds nothing; make it an error.
3. **The error plugin**, `server/src/lib/api-error.ts`, `server/src/plugins/json-body.ts` and `server/src/plugins/auth/index.ts`, all as in the move map. Every test passes unchanged.
4. **Feature folders.** Use `git mv`, file by file per the map, so history follows. Add the `index.ts` files, and move `seriesRepeats` and the `removeCalendar` parameter type. Add `.dependency-cruiser.cjs`, and check that a deliberate import of `server/src/features/events/store.js` from `server/src/features/search/` fails it.
5. **The type provider and the schemas, one feature per commit:** health, settings, calendars, push, events, occurrences, search. Do the shared output-safe repeat before events. Each commit:
   - declares params, querystring, body and response;
   - removes that feature's `.parse(request.…)`;
   - types the plugin as `FastifyPluginAsyncZod<FeatureContext>`;
   - adds the new tests that apply.
6. **After.** Save the same JSON again and diff it against step 1's. A field that disappeared is a leak (keep it dropped and list it) or a missing schema field (add it). Put the diff's summary in the `log.md` entry.
7. **Strict.** Drop `check-structure`'s `--warn-only` and make dependency-cruiser part of `check:conventions`.
8. **Corpus.**
   - Revisit [wiki/decisions.md](../../wiki/decisions.md), **"React + Fastify + SQLite, on Shelfmark's layout"**: the server no longer splits by layer (`server/src/routes/`, `server/src/store/`) as Shelfmark's does. It is grouped by feature, by the owner's call of 2026-11-09. The three workspaces and the auth library are unchanged.
   - Add an entry adopting the structure, with what was rejected (Shelfmark's layer split, autoload, TypeBox) and why.
   - Update the pages listed under Files you OWN, `.claude/rules/server.md`, [wiki/status.md](../../wiki/status.md) and [log.md](../../log.md).
   - Run `bash corpus/lint.sh` until it is clean.

## Acceptance

- [ ] `check-structure` passes **strict**, with any exception in `scripts/conventions.json` and its reason. Its counts before and after are in the outcome note, for the skills library's brief 16 table.
- [ ] `grep -rnE "\.(safe)?[pP]arse\(request\." server/src` prints nothing. Every route in the table has a `schema` with a `response`.
- [ ] `grep -rn "process\.env" server/src --include=*.ts | grep -v "\.test\.ts"` prints only `config.ts`, and ESLint's `no-process-env` (from `eslint-plugin-n`) is an error.
- [ ] The weekly-`byDay` round trip, the stripped-field test, the serialization-500 test and the health test pass, along with every existing test unchanged.
- [ ] The before and after JSON comparison is in `log.md`, with every dropped field named.
- [ ] `npm run build` writes `server/dist/server.js`. `docker build -f infrastructure/Dockerfile .` succeeds with its `CMD` on `server/dist/server.js`, and the container answers its health check.
- [ ] dependency-cruiser fails on a deliberate cross-feature import and passes clean.
- [ ] `npm run check` passes, and `bash corpus/lint.sh` ends clean.

## Interplay

- If brief 01 has dropped `server/package.json`'s `exports` as unused, step 2 has two fewer lines to change.
- The skills library should hear about the transform trap before the other servers run brief 16. It applies to any repo whose shared schemas transform. The error-body question is settled (decision 4).

## Outcome (2026-11-12)

Built on `main`, one commit per step, by almanac-04. The log entry ([log.md](../../log.md)) holds the details; this is the short form.

- **check-structure**, strict, no `conventions.json` exception. Before: 31 errors and 4 warnings (rule-1 1, rule-3 4, rule-6 26, rule-11 4). After: 0 errors and 4 warnings (rule-11 4: three web files and `features/events/service.ts`, 610 lines, left as the brief says).
- **Moves.** `server/src/` follows the move map: `server.ts`, `plugins/` (errors, json-body, auth), `features/<name>/` for health, calendars, events, occurrences, search, settings, push and reminders (each with an `index.ts` and its own options type), `lib/` (`api-error.ts`, `id-params.ts`, `env-file.ts`). `seriesRepeats` moved into `expand.ts`, and `removeCalendar` takes the structural `{ remove }` it uses, so events never import calendars. dependency-cruiser has no override and passes; a deliberate `features/events/store.js` import from `features/search/` fails it (exit 1).
- **Entry file.** `server/dist/server.js`: the Dockerfile `CMD`, the root `start`, `server/package.json`'s `main`, `dev`, `start` and `exports["."]` were repointed (the exports stay: knip doesn't call them unused).
- **Versions.** zod 4.5.4 to 4.6.7 in `shared`, `server` and the root override (one copy), against the brief's "no zod move": the shared builder notes of 2026-11-12 name 4.6.7 (GHSA-mrhx-c7xc-m3w5). Fastify stays on 5.12.7. New: `@fastify/type-provider-zod` 1.0.3, `@fastify/swagger` 9.9.3 and `openapi-types` 12.1.3 (its peers), `fastify-plugin` 6.0.1, `close-with-grace` 2.5.0.
- **Sign-in code.** `ceb06ab` is moves and import paths only. `0e66d87` takes `signIn` out of `app.ts` into `plugins/auth/index.ts` with `fastify-plugin` and an `AuthOptions` type (the body is unchanged). `server/vendor/` is untouched.
- **Comparison.** 70 replies captured through the built app on a scratch database with `inject()` (not `demo-seed.mjs`), before and after; 64 identical, no field dropped. Six differ in one message ("received undefined" became "received null" for a request with no body). Two reorderings follow from validating first (a bad body on a missing id is now 400, not 404, on PATCH calendars and events; a bad body on PUT push subscriptions with push off is 400, not 404); no capture covers them.
- **Deploy.** `all`: `shared/`'s `occurrenceSchema` (used by `web/src/data/occurrences.ts`) now uses `storedRepeatSchema`, and zod's version changed in the web bundle too, so the web build differs although `web/` was not touched. The owner's check: the container turns healthy and `docker stop` ends at once.
- **Open for the owner** (decision 10, on the board as a question): the timeouts (10 s, 30 s, 125 s) and `trustProxy` (loopback plus `AUTH_TRUSTED_PROXIES`). The sign-in library reads the socket and `X-Forwarded-For` itself (`ward-auth.js:4884`), so `trustProxy` doesn't change it.
- **Not run.** `docker build` (local Docker gives an I/O error). In its place the built server ran on a real socket with every setting pinned: health 200, a signed-out request 401, SIGTERM exit 0 from the node PID. It still loaded the repo's `.env` (a fixed path) for anything unpinned; every key was pinned and Ward and VAPID logged as off. Full `npm run check` ran at the start, after strict and at the end; the steps between ran typecheck, ESLint and the tests of what changed.
