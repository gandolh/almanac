---
paths:
  - "server/src/**"
  - "shared/src/**"
---

# The API (`server/src`, `shared/src`)

- Read the `code-structure` skill before you add or move a route, a plugin or a
  module. Also read [wiki/architecture.md](../../corpus/wiki/architecture.md),
  [wiki/data-model.md](../../corpus/wiki/data-model.md) and
  [wiki/recurrence.md](../../corpus/wiki/recurrence.md).
- `server/src/config.ts` is the only reader of the environment, the `.env`
  file and the data folder (`n/no-process-env` is an error). `server.ts` is
  the only file that listens; `app.ts` builds the app and never does.
- A feature is `server/src/features/<name>/`: `routes.ts`, `store.ts`, an
  `index.ts` other code imports through, and its own options type (never
  `FeatureContext` from `app.ts`). Cross-cutting code (errors, the JSON body,
  sign-in) is `server/src/plugins/`, wrapped in `fastify-plugin`, registered
  in `buildApp` before the features. `lib/` is pure and never imports Fastify.
- Every route declares `params`, `querystring` and `body` as it takes them and
  a `response` for each status it sends, through
  `@fastify/type-provider-zod` (`FastifyPluginAsyncZod`). No handler parses
  request input. A response schema has no `.transform()` and no `.strict()`:
  `occurrenceSchema` uses `storedRepeatSchema`, the input schemas keep
  `repeatSchema`. Add a test that strips a field and one for the 500.
- Errors are `throw new ApiError(code, message)`, and the body is
  `{ error: { code, message } }`, which `web/src/api.ts` parses.
- Every row is scoped to a user through `currentUserId(request)`; another
  user's id answers 404.
- The sign-in feature registers first.
- A `FeatureContext` field only when two features need it.
- `server/vendor/` is Ward's generated library. Never edit it.
- Tests go through `startTestApp` and `signInAs` (a method of the app it returns) in
  `server/src/testing/testApp.ts`; `featureApp` in the same folder runs one
  feature alone with a faked store, for the schema-failure cases.
- Times are UTC milliseconds, or dates through Temporal. Never
  `toLocaleString`.
- `npm run check:conventions` runs `check-structure` (strict) and
  dependency-cruiser over these folders; the only finding left is rule 11's
  warning for `features/events/service.ts`.
