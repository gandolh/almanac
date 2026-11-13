---
summary: Almanac's locked calls on the estate's conventions, split from decisions.md on 2026-11-13, each with date, rejected alternatives and reason. The house style, formatted and checked (Prettier at 120, vendored configs, one gate, the two convention checkers strict); the server grouped by feature with a schema on every route, the error body unchanged, and the process settings.
updated: 2026-11-13
---

# Decisions: the conventions

These two entries moved here from [decisions.md](decisions.md) on 2026-11-13,
unchanged, when that page passed 200 lines. They pass the same three tests
and change the same way: an explicit revisit and a `log.md` entry.

## The house style, formatted and checked
_2026-11-11_, the owner's grilling of 2026-11-10. Almanac holds a copy of the
skills library's `house-style` folder in `vendor/house-style/` (version
header inside, refreshed by `npm run house-style:sync`, never edited), and its
configs extend it: Prettier at width 120 with trailing commas, double quotes
and semicolons; a thin ESLint config with six typed rules; knip and
dependency-cruiser presets; `npm run check` as the gate and `check:fast` as
its subset. The reformat is one commit, listed in `.git-blame-ignore-revs`.
Markdown stays out of Prettier. `tsconfig.base.json` carries the house flags
itself instead of extending the copy, because the image build copies only
that file before `tsc -b server`. Rejected: width 130, which churns the least
(333 lines against 502) but gives the estate two widths; a git or tarball
dependency, which needs `git` in the Docker `deps` stage; and committing
hooks to `.claude/settings.json`, since the plugin carries them. Two rules
started softer: `n/no-process-env` and dependency-cruiser's `no-circular` were
warnings until the server took its settings from `config.ts` and each feature
had its own options type (both are errors since 2026-11-12), and the two
convention checkers ran `--warn-only` until the Base UI, Tailwind and server
layout work landed (both strict since 2026-11-12).

## The server in the house code structure
_2026-11-12_, the owner's call of 2026-11-09, grilled 2026-11-10; the
`code-structure` skill. `server/src/` has `server.ts` (the only file that
listens: settings, `buildApp`, `close-with-grace`, then `listen`), `app.ts`
(`buildApp(config, options)`, which never listens), `config.ts` (the only
reader of the environment, and of the `.env` file and the data folder),
`plugins/` (errors, the JSON body, sign-in: each wrapped in `fastify-plugin`,
registered in that order, errors first), `features/<name>/` (health,
calendars, events, occurrences, search, settings, push, reminders: each with an
`index.ts`, its own options type, its routes and its store, and used by others
through the index only), `lib/` (the `ApiError` class, `idParamsSchema`, the
env-file helper; no Fastify import) and `db/`. Every route declares its
params, querystring and body, and a `response` for each status it sends,
through `@fastify/type-provider-zod`: a field a schema doesn't name never
leaves the server. The error body stays `{ error: { code, message } }`, which
`web/src/api.ts` parses; a reply that fails its schema is a 500 `internal`
with a fixed message, logged with the method and URL. `occurrenceSchema`
uses `storedRepeatSchema` (no `.transform()`), because zod throws when it
encodes through one; the input schemas keep the sorting `repeatSchema`.
`check-structure` and every dependency-cruiser rule are strict. The process
sets `trustProxy` (loopback plus `AUTH_TRUSTED_PROXIES`), `connectionTimeout`
10 s, `requestTimeout` 30 s and `keepAliveTimeout` 125 s (above Caddy's
two-minute idle keep-alive); these are defaults, still open for the owner.
Rejected: Shelfmark's layer split (a feature's change should stay in one
folder), `@fastify/autoload` (the registration order is the architecture, and
a feature registered by name is found with grep), and TypeBox (the shared
schemas are zod and the web imports them). The before-and-after JSON comparison is in
[log.md](../log.md).
