# Task 02: Accounts and sign-in

## Context

Almanac has its own login plus "Sign in with Ward", exactly like Shelfmark
(`../shelfmark`), but with several users, each seeing only their own data
([decisions.md](../../wiki/decisions.md), "Several users"). The vendored Ward
library (ward-auth 0.3.1) already supports this: `seedUsers`, auto-creating a
user on the first Ward sign-in (`createUserWithWardLink`, needs a Ward grant),
and `request.auth.user.id`. There is no sign-up page: do not set the plugin's
`registration` option. Words: [glossary.md](../../wiki/glossary.md) ("User").

Depends on: 01.

## Files you OWN

```
server/vendor/ward/*          (copied byte for byte from ../shelfmark/server/vendor/ward)
web/vendor/ward/*             (same copy)
server/src/auth/accounts.ts  server/src/auth/guard.ts  server/src/auth/*.test.ts
server/src/seed.ts  server/src/seed.test.ts
server/src/app.ts             (auth registration only)
server/src/testing/testApp.ts (add signIn, startSignedInApp, sessionCookieFrom)
web/src/api.ts  web/src/router.ts
web/src/auth/*  web/src/account/*
web/src/components/*          (the primitives the login page and account dialogs need)
web/src/styles/tokens.css  web/src/styles/base.css  web/src/styles/components.css
web/src/App.tsx  web/src/main.tsx
```

## Files you must NOT touch

`shared/` beyond what auth needs (it should need nothing), `server/src/db/*`,
anything calendar-related.

## What to do

1. Vendor the Ward library into `server/vendor/ward/` and `web/vendor/ward/`
   with its README and LICENSE; import it by relative path as Shelfmark does.
2. `server/src/auth/accounts.ts`: `USER_ROLE = "user"` (the only role; nothing
   checks roles), `openAccounts(db)`, `seedUser(accounts, {username, password})`.
   `guard.ts`: copy Shelfmark's origin guard as is.
3. `app.ts`: register `wardAuth` the way Shelfmark does (cookie
   `almanac_session`, `cookiePath: config.apiPrefix`, `PUBLIC_ROUTES =
   ["GET /api/health"]`, `ward.roleFor: () => USER_ROLE`, login and settings
   paths under `config.webBase`), then the origin guard. Auth comes first in
   `FEATURES`. Add a typed helper `currentUserId(request): string` that later
   routes use; it throws a 401 `ApiError` if `request.auth` is null.
4. `seed.ts`: Shelfmark's seed (env or TTY prompt, idempotent), seeding one
   user with `USER_ROLE`. Never print the password.
5. `testing/testApp.ts`: `t.signIn(username = "owner")` seeds that user and
   logs in for real; `startSignedInApp()`; also `t.signInAs(username)` so
   later briefs can test that one user cannot see another's data.
6. Web: copy Shelfmark's `api.ts` (base `/almanac-api`), `auth/` (session
   with `basePath: "/almanac-api/auth"`, AuthGate, LoginPage with the Ward
   button shown only when Ward is enabled, messages, Field, icons, auth.css),
   `account/` (actions without `downloadBackup`, ChangePassword including the
   set-a-local-password path for Ward-created users), the components they
   need, and the three style sheets. Retint `tokens.css` toward a plain
   Google-like light palette: white surfaces, `#1f1f1f` text, `#dadce0`
   hairlines, one blue accent `#0b57d0`, system font stack with Roboto. Light
   only: no `prefers-color-scheme` rules. Brief 06 owns the final tokens.
7. `router.ts`: Shelfmark's hand-rolled router with two routes for now,
   `home: "/"` and `login: "/login"`. Brief 06 adds the calendar routes.
8. `App.tsx`: `<AuthGate>` around a placeholder home that shows the signed-in
   username and a Sign out button.

## Acceptance

- Server tests: login success and failure, session endpoint signed in and
  out, a protected route answers 401 without a cookie, a cross-origin POST is
  refused, seeding twice leaves the user unchanged, two seeded users get
  different ids.
- Web tests (Node, `renderToStaticMarkup`, as Shelfmark): LoginView with and
  without the Ward button.
- With `.env` seed values, `npm run seed -w @almanac/server` then
  `npm run dev`: signing in at `/almanac/login` lands on the home placeholder;
  Sign out returns to the login page.
- typecheck, lint, test and build pass.
