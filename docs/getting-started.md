# Getting started

Run Almanac on your own machine: the API and the web app. Deploying is a
separate, hand-run step in [owner-setup.md](owner-setup.md).

## Prerequisites

- Node 24 or later and npm. `engines` in `package.json` sets the Node floor.
- Optional, for "Sign in with Ward": the local Ward container from the sibling
  `wzd_auth` repo, started and seeded as its
  `infrastructure/local/README.md` describes. Without it Almanac runs with
  local accounts only.

## Install

```bash
npm install
```

## Configure

Copy `.env.example` to `.env`, which git ignores. The server reads it at
start-up, and the Vite dev server reads it for the API port. Every key is
optional; an empty value counts as not set.

| Variable | Purpose | Default or source |
|---|---|---|
| `HOST` | Address the API binds to | `127.0.0.1` |
| `PORT` | API port; the dev proxy follows it | `8809` |
| `DATA_DIR` | Folder for `almanac.db`. A relative path is taken from the repo root | `./data` |
| `PUBLIC_ORIGIN` | The app's own origin as the browser sees it, with no path | `http://localhost:5177` |
| `ALMANAC_API_PREFIX`, `ALMANAC_BASE` | The API prefix and the web base path as the browser sees them | `/almanac-api`, `/almanac/` |
| `SEED_USERNAME`, `SEED_PASSWORD` | The account the seed creates; it asks for whichever is empty | you choose |
| `AUTH_TRUSTED_PROXIES` | Peers besides loopback whose `X-Forwarded-For` the login lockout believes. Empty is right locally | empty |
| `WARD_OIDC_ISSUER`, `WARD_OIDC_CLIENT_ID`, `WARD_OIDC_CLIENT_KEY`, `WARD_OIDC_REDIRECT_URI`, `WARD_OIDC_POST_LOGOUT_REDIRECT_URI` | Optional. "Sign in with Ward". The key is a secret | Ward's local seed writes all five |

## Create an account

Almanac has no sign-up page. Make the first account with the seed:

```bash
npm run seed -w @almanac/server
```

It asks on the terminal for a username and password, or reads
`SEED_USERNAME` and `SEED_PASSWORD` from `.env` or the environment. The seed
saves the password in the database and nowhere else. It leaves an existing
account as it is, password included, so run it again with another name to add
another account. Each account starts with one calendar, Personal.

## Run

```bash
npm run dev
```

This builds `shared`, then runs the API under `tsx watch` and the Vite dev
server side by side. Open <http://localhost:5177/almanac/> and sign in.

- Vite serves the app under `/almanac/` on port 5177 and stops if that port
  is taken.
- The API listens on port 8809. Vite proxies `/almanac-api` to it with the
  prefix stripped, the way Caddy does in production, so the paths match.
- The database is `data/almanac.db`.

## Try "Sign in with Ward"

Start Ward locally and run its seed, as `../wzd_auth/infrastructure/local/README.md`
describes. The seed registers Almanac and writes the five `WARD_OIDC_*` values
into this repo's `.env`. Restart `npm run dev` afterwards. The login page then
shows the Ward button. Your Ward account needs a grant on the `almanac` app in
the local Ward console, or Ward refuses the sign-in.

## Test, typecheck, lint, build

```bash
npm test            # vitest, every workspace
npm run typecheck
npm run lint
npm run build       # tsc for shared and server, then the web app
```

## Common problems

- **`npm run dev` stops with `ENOSPC`.** The system ran out of file watchers,
  which happens when VS Code holds most of them. Run it with polling instead:
  `CHOKIDAR_USEPOLLING=1 CHOKIDAR_INTERVAL=300 npm run dev`.
- **The server prints `Almanac cannot start:` and names a key.** A value in
  `.env` is malformed, such as a `PUBLIC_ORIGIN` with a path, or a
  `WARD_OIDC_*` value is missing while `WARD_OIDC_ISSUER` is set. The message
  says which.
- **Port 5177 is in use.** The dev server won't pick another port. Stop
  whatever holds it.
- **The login page has no Ward button.** `WARD_OIDC_ISSUER` is not set in
  `.env`. Local accounts still work.
