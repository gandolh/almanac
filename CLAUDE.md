# Almanac

A personal calendar with day, week, month and year views: React on FullCalendar,
Fastify and SQLite. Read [corpus/index.md](corpus/index.md) first.

## Commands

- `npm run dev`: the API on 8809 and the web app on 5177.
- `npm run check`: typecheck, lint, format check, conventions, tests. Run it
  before every hand-back.
- `npm run check:fast`: the typecheck, then ESLint on the changed files. The
  Stop hook runs it.
- `npx vitest run <file>`: one test file.
- `npm run format`: Prettier writes every file it covers (Markdown stays out).
- `npm run seed -w @almanac/server`: a local account.
- `npm run vapid-keys -w @almanac/server`: new Web Push keys.

## Places that mislead

- `pretest` builds `shared`, so a changed schema there needs it.
- The typecheck is two runs: `tsc -b` (shared, server), then
  `tsc -p web --noEmit`.
- `.env` sits at the repo root, not in `server/`.
- Two dev ports: 8809 is the API, 5177 the web app. Vite forwards `/api`.
- `npm run dev` stopping with `ENOSPC` is the file-watcher limit; the fix is in
  [docs/getting-started.md](docs/getting-started.md).
- `vendor/house-style/`, `server/vendor/` and `web/vendor/` are generated
  copies. Never edit them; `npm run house-style:sync` refreshes the first.

## Hard rules

- **No secrets.** Never write a password, API key or token into the corpus or
  the repo. The seed values and the `WARD_OIDC_*` values live in `.env`
  (gitignored); name a secret by its file and key, never by its value.
- **Placeholder contact.** Where an address is needed, use
  `johndoe@example.com` until the owner's mail is live.
- **No CI.** Don't add GitHub Actions, runners or other GitHub-specific
  automation.
- **No pushes.** Commit locally on `main`. The owner pushes.
- **Deploys, git hooks and `npm link` are owner steps.** Write the exact
  commands down and hand them over.
- Never write the production domain in the corpus or the docs.

## brief-board

Brief progress goes on brief-board. Run `brief-board guide` before you
start or resume a brief, and follow it.
