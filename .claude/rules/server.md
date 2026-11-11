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
- `server/src/config.ts` is the only reader of the environment. `index.ts`
  and `seed.ts` still read it themselves (an ESLint warning for now); add no
  other reader.
- Errors are `throw new ApiError(code, message)`, and the body is
  `{ error: { code, message } }`, which `web/src/api.ts` parses.
- Every row is scoped to a user through `currentUserId(request)`; another
  user's id answers 404.
- The sign-in feature registers first.
- A `FeatureContext` field only when two features need it.
- `server/vendor/` is Ward's generated library. Never edit it.
- Tests go through `startTestApp` and `signInAs` (a method of the app it returns) in
  `server/src/testing/testApp.ts`.
- Times are UTC milliseconds, or dates through Temporal. Never
  `toLocaleString`.
- `npm run check:conventions` runs `check-structure` over these folders,
  `--warn-only` until the server layout work lands.
