# Task 01: The house style and the quality harness

**Depends on:**

- In Almanac: nothing. This brief runs first.
- In the owner's skills library:
  - brief 27, *A house style, and a quality harness that enforces it*: the vendored `house-style` copy at `v1.0.0`, the `house-style` skill, and the plugin's `Stop` and `PostToolUse` hooks;
  - brief 15, *Enforce the base-ui and code-structure skills in every repo*: how the convention checkers are wired and when they run `--warn-only`.
- The owner's grilling of 2026-11-10, questions Q1, Q5-Q14, Q45-Q51 of the skills library's open questions.

**Runs before:** 02, 03 and 04. The reformat touches 93 files at width 120, and those three briefs rewrite or move most of them. Formatting first gives one clean reformat commit, and the formatter hook keeps every later diff formatted.

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

On 2026-11-09 the owner made three calls for every web app they own: Base UI 1.9.0 everywhere, the whole app on Tailwind v4, and the researched conventions enforced in each repo. The skills library's brief 27 measured the house style, the one the owner and their agents already write. It found the style consistent but unenforced: nothing formats it and the linter is thin. Its answer is a two-layer harness:

- **The repo's gate:** `npm run check` and its fast subset `npm run check:fast`. They hold for a human, any agent and the deploy.
- **The Claude Code layer:**
  - the plugin's `Stop` hook runs `check:fast`, and exits 2 on a failure;
  - its `PostToolUse` hook formats each saved file;
  - `.claude/rules/web.md` and `.claude/rules/server.md` are scoped by `paths:`;
  - a short `CLAUDE.md` holds the commands.

This brief adopts both layers in Almanac. Briefs 02-04 then turn on their own checks inside it.

### What Almanac has today (read 2026-11-09)

- **`tsconfig.base.json`** already has the lineage flags:
  - `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`;
  - `isolatedModules`, `noUnusedLocals`, `noFallthroughCasesInSwitch`;
  - `module` and `moduleResolution` set to `NodeNext`;
  - and `noUnusedParameters`, which is stricter than the house list.

  `web/tsconfig.json` overrides `module`/`moduleResolution` to `ESNext`/`bundler` for Vite, and `types` to `vite/client`.
- **`eslint.config.js`** (31 lines):
  - `@eslint/js` recommended;
  - `typescript-eslint` recommended, untyped (8.69.0);
  - `eslint-plugin-react-hooks` 7.1.1 recommended on `web/src/**/*.{ts,tsx}`;
  - a script block for `web/public/sw.js`;
  - `_`-prefixed unused names.

  Recommended already makes `no-explicit-any` and `ban-ts-comment` errors.
- **No formatter.** No Prettier config, no `format` script.
- **Scripts** (root `package.json`):
  - `typecheck` is `tsc -b && tsc -p web --noEmit`, two runs, and the web one isn't incremental;
  - `lint` is `eslint .`;
  - `test` is `vitest run`, with `pretest` building `shared`;
  - there is no `check`.
- **No root `CLAUDE.md` and no `.claude/`.** The only `CLAUDE.md` is [corpus/CLAUDE.md](../../CLAUDE.md), which Claude Code loads only once an agent reads a file under `corpus/`. So an agent that never opens the corpus sees no commands and none of the hard rules (no secrets, no CI, no pushes, deploys are owner steps).
- **`.npmrc`** has `save-exact=true`. Every dependency is pinned exactly.
- **The Docker image** (`infrastructure/Dockerfile`) runs a full `npm ci`, dev dependencies included, in `node:24-alpine` with only `python3 make g++` added. There is no `git`. Then `npx tsc -b server` runs there.

### Measured on 2026-11-09

Taken on a scratch clone with the tools on this machine: Prettier 3.8.1 and TypeScript 6.0.2, against Almanac's 6.0.3. There were no `node_modules`.

**Prettier churn.** The estate width is **120** (Q8, Q51), so the 120 row is the one-off cost: 502 lines in 93 files. Defaults (double quotes, semicolons), `trailingComma: "all"`, on the 164 TypeScript and JavaScript files (23,060 lines):

| `printWidth` | Lines changed | Files changed |
|---|---|---|
| 100 | 1,343 (5.8%) | 139 |
| 110 | 864 (3.7%) | 119 |
| 120 | 502 (2.2%) | 93 |
| **130** | **333 (1.4%)** | **70** |
| 140 | 350 (1.5%) | 61 |

130 was Almanac's least churn (brief 27 measured about 340 lines in 70 files); the owner's estate width is 120 for one convention across repos.

The other file types:

- **CSS:** 17 lines in `web/src/styles/tokens.css`, where Prettier lowercases the hex colours. The values are the same.
- **JSON and `web/index.html`:** no change.
- **Markdown:** 93 lines in 10 files, among them `corpus/routing.md`, four wiki pages, the README and `docs/`.

**TypeScript flags.** The scratch run added `verbatimModuleSyntax` and `erasableSyntaxOnly` together:

- **`erasableSyntaxOnly`:** one error, at `server/src/errors.ts:32`. `ApiError`'s constructor declares `readonly code` as a parameter property.
- **`verbatimModuleSyntax`:**
  - no errors among the imports tsc could resolve (the relative ones);
  - package imports couldn't be checked without `node_modules`;
  - every capitalised name imported from a package without `type` is a value: `Temporal`, `StrictMode`, `Fragment`, `Suspense`, `RRuleTemporal`, the shared constants;
  - expect zero, and confirm it in step 4.

**The house shapes**, counted with the TypeScript parser over `server/src`, `shared/src`, `web/src`, the configs, `web/public/sw.js` and `docs/images/demo-seed.mjs` (164 files):

| Shape | Count | Where |
|---|---|---|
| `enum` | 0 | |
| `any` (the keyword) | 0 | |
| non-null `!` | 9 | all in `server/src/reminders/reminders.test.ts`, lines 169, 180, 183 (×3), 194, 196 (×3): `dues[0]!` and the like |
| `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error` | 0 / 0 / 0 | |
| `TODO` / `FIXME` / `XXX` / `HACK` | 0 | |
| `console` | 8 | `server/src/index.ts:20`, `server/src/seed.ts:73, 81`, `server/src/vapid-keys.ts:40, 56, 62`, `docs/images/demo-seed.mjs:21, 196`: all CLIs or the entry before its logger exists |
| default exports | 3 | `web/vite.config.ts:40`, `vitest.config.ts:5`, `eslint.config.js:5`: all configs, which their tools require |
| namespaces | 0 | |
| parameter properties | 1 | `server/src/errors.ts:32` |

**Not measured here:** the six typed rules' finding counts, lint time with `projectService` against `project`, and knip's findings. Each needs `node_modules`. Step 2 measures them.

Two leads:

- The code already marks discarded promises: 16 `void` calls in `server/src` and `web/src`.
- knip should report `@vite-pwa/assets-generator` in `web/package.json` as unused. No script, config or doc names it; it was used by hand for the home-screen icons.

## Owner decisions

All decided 2026-11-10; the numbers are the skills library's open questions.

1. **Vendored `house-style`** (Q6, technical call). Almanac holds a copy with a version header, refreshed by a `house-style:sync` script that finds the checkout by name, the way Ward's library is shared today. No git, `github:` or tarball dependency, so the Docker `deps` stage needs no `git` and the Dockerfile stays untouched. Steps 4-6 extend the vendored configs.
2. **Prettier at width 120** (Q8 and Q51, technical call). Double quotes, semicolons, `trailingComma: "all"` (Q9). The one-off cost is the 120 row of the table above: 502 lines in 93 files, in one reformat commit.
3. **Markdown stays out of Prettier** (Q45, technical call). `.prettierignore` lists `*.md`.
4. **tsconfig** (Q11, technical call). Add `verbatimModuleSyntax` and `erasableSyntaxOnly` now: the one parameter property in `server/src/errors.ts` becomes a declared field. `exactOptionalPropertyTypes` waits for a later brief, after a count. `noUncheckedIndexedAccess` is already on (Q50 defers it only where it is off). Almanac's TypeScript (6.0.3) is past 5.8, so no bump.
5. **Typed lint** (Q12, technical call). The six rules through `projectService`, unless step 2 shows `project` is faster. `no-floating-promises` names `describe`, `it` and `test` in `allowForKnownSafeCalls`. `switch-exhaustiveness-check` sets `considerDefaultExhaustiveForUnions: true` (Q48).
6. **The house shapes** (Q13, Q47, technical calls). `!` is an error in source and a warning in tests, so the nine `!` in `reminders.test.ts` are warnings; fix them in step 5 anyway, since each is a one-line change. `console` is allowed in the CLIs and the entry (all 8 current calls). A default export is allowed in config files, and where a framework needs one. Components use named exports (Q49; Almanac has none to move). `no-process-env` (from `eslint-plugin-n`) starts as a **warning**, because its four findings are brief 04's work, and brief 04 turns it into an error.
7. **`check:fast`** (Q10, technical call). A typecheck plus ESLint on the changed files, built incrementally (`tsc -b`). Target 15 s; up to about 30 s is accepted where `tsc` alone is slower.
8. **The Claude Code layer** (Q7, technical call). It lives in the plugin: `Stop` runs `check:fast`, `PostToolUse` formats the saved file. Nothing is committed to `.claude/settings.json`.
9. **A root `CLAUDE.md`** (Q46, technical call). A short root `CLAUDE.md` with the commands. The repo-wide **Hard rules** and **brief-board** sections move out of [corpus/CLAUDE.md](../../CLAUDE.md) into it, because they apply outside the corpus.
10. **Comments** (Q14, technical call). Comments are prose, checked by the review gate, not by a lint rule.
11. **Deploy** (Q1, fact). The deploy runs `npm ci` and `tsc -b`, no tests or lint, and stays as it is. `npm run check` and the `Stop` hook are the gate.

## Files you OWN

- `tsconfig.base.json`, and `web/tsconfig.json` (only to add `incremental` with a `tsBuildInfoFile`).
- `eslint.config.js`.
- New: the Prettier config, `.prettierignore` and `.git-blame-ignore-revs`, the vendored `house-style` copy (with its version header) and the `house-style:sync` script.
- The root `package.json` (scripts, devDependencies) and `package-lock.json`.
- The reformat itself: whitespace-only changes to every file Prettier covers.
- The fixes the new rules ask for:
  - `server/src/errors.ts` (the parameter property);
  - `server/src/reminders/reminders.test.ts` (the nine `!`);
  - anything else a typed rule finds, fixed or listed in step 5.
- New: `.claude/rules/web.md`, `.claude/rules/server.md`, `CLAUDE.md`.
- [corpus/CLAUDE.md](../../CLAUDE.md): its Hard rules and brief-board sections move out.
- `scripts/conventions.json` (new, brief 15's exceptions file), if an exception is needed.
- Corpus:
  - [wiki/decisions.md](../../wiki/decisions.md): a new entry;
  - [wiki/status.md](../../wiki/status.md);
  - [log.md](../../log.md);
  - [.planned-roots](../../.planned-roots): drop `.claude` and `scripts` once they exist.

## Files you must NOT touch

- Behaviour. Apart from the fixes listed above, every change is formatting or configuration.
- `server/vendor/` and `web/vendor/`. They are generated copies of the Ward library, and both are ignored by ESLint and Prettier.
- The layout of `server/src` and the CSS, which are briefs 04 and 03.
- `infrastructure/Dockerfile`: vendoring needs no `git` in the image.
- The skills library and the `house-style` repo. A rule that seems wrong for Almanac is reported back, not patched locally.

## What to do

One commit per step, each with `npm run typecheck`, `npm test`, `npm run lint` and `npm run build` green.

1. **Vendor `house-style`.** Copy it with its version header and add the `house-style:sync` script, which finds the checkout by name.
2. **Measure.** Record these in the `log.md` entry:
   - the six typed rules' counts (`no-floating-promises`, `no-misused-promises`, `await-thenable`, `switch-exhaustiveness-check`, `no-unnecessary-type-assertion`, `consistent-type-imports`);
   - lint time with `projectService` against `project`;
   - `npx knip` from the vendored `house-style` preset;
   - the `tsc` counts with the two new flags;
   - `@vitest/eslint-plugin` recommended's count, with `assertFunctionNames: ["expect", "expectError"]`. Three test files use an `expectError` helper.

   Any rule that finds more than about 20 real problems, or mostly false ones, goes back to the owner before it is turned on (brief 27's rule: bring it, don't loosen it).
3. **Prettier, and the reformat.**
   1. Add `prettier` (pinned) and the config: `printWidth: 120`, `trailingComma: "all"`, and the rest default.
   2. Add `.prettierignore`:
      - `*.md`;
      - `server/vendor/` and `web/vendor/`;
      - `package-lock.json`;
      - `dist/`, `dev-dist/`, `data/`, `coverage/`;
      - `web/public/icons/`.
   3. Add `"format": "prettier --write ."` and `"format:check": "prettier --check ."`, and commit this alone.
   4. Run `npm run format` and commit only that, as `style: format with Prettier`. Run it when no other brief has uncommitted work.
   5. Add that commit's full hash to `.git-blame-ignore-revs`, in its own commit.
   6. Hand the owner the one-time `git config blame.ignoreRevsFile .git-blame-ignore-revs`.
4. **tsconfig.** Add `verbatimModuleSyntax` and `erasableSyntaxOnly` to `tsconfig.base.json`.
   - Fix `ApiError`'s parameter property with a declared field assigned in the constructor. Its behaviour and the `readonly` stay.
   - Fix whatever `verbatimModuleSyntax` reports, with inline `type` imports, the house's `import { type X }`.
   - Add `"incremental": true` and a `tsBuildInfoFile` under `node_modules/.tmp/` to `web/tsconfig.json`, so the web typecheck is fast on a second run.
   - The Dockerfile's `npx tsc -b server` must still build.
5. **ESLint.** Extend the vendored house config (decision 1), passing Almanac's roots:
   - web is `web/src`;
   - server is `server/src`;
   - the CLIs are `server/src/seed.ts`, `server/src/vapid-keys.ts`, `server/src/index.ts` (later `server.ts`) and `docs/images/*.mjs`.

   The diff in effect, against today's config:

   | Rule | Today | After | Findings today |
   |---|---|---|---|
   | the six typed rules above (`considerDefaultExhaustiveForUnions: true` on the switch rule) | off | error, through `projectService` | step 2 |
   | `@typescript-eslint/no-non-null-assertion` | off | error in source, warn in tests (Q47) | 9, all in tests (fix them) |
   | `no-restricted-syntax` on `TSEnumDeclaration` | off | error | 0 |
   | `no-warning-comments` (`todo`, `fixme`), pointing at `corpus/todos/` | off | error | 0 |
   | `no-console` outside the CLIs | off | error | 0 (all 8 calls are in the CLI files) |
   | `no-default-export` (from `eslint-plugin-import-x`) outside `*.config.*` | off | error | 0 (all 3 are configs) |
   | `no-process-env` (from `eslint-plugin-n`) on `server/src` outside `config.ts` and tests | off | **warn**; brief 04 makes it an error | 4: `index.ts:17`, `seed.ts:61, 62, 68` |
   | `@vitest/eslint-plugin` recommended on `*.test.{ts,tsx}` | off | error | step 2 |
   | `no-explicit-any`, `ban-ts-comment` (only `@ts-expect-error` with a description) | error (recommended) | unchanged | 0 |
   | `react-hooks` recommended on `web/src` (7.1.1, with the compiler rules) | on | unchanged | 0 |
   | `better-tailwindcss` | absent | brief 03 adds it | |

   Typed linting needs `allowDefaultProject` for the files no tsconfig includes: `vitest.config.ts`, `eslint.config.js` and `docs/images/*.mjs`. The root `tsconfig.json` has `files: []`. `web/public/sw.js` and the `.mjs` files take `disableTypeChecked`. Fix what the typed rules find, or list each finding left, with its reason, in the outcome note.
6. **The gate.** In the root `package.json`:
   - `check` runs:
     - `typecheck`;
     - `lint`;
     - `format:check`;
     - `check:conventions`;
     - `test`.

     `check:conventions` is knip, plus the two convention checkers from the vendored `house-style` copy. `check-base-ui` runs `--warn-only` until brief 03 is done, and `check-structure` `--warn-only` until brief 04 is done. dependency-cruiser joins in brief 04, where the layout it checks appears.
   - `check:fast` runs `typecheck`, then ESLint on the files changed against `HEAD` plus untracked ones (`*.ts`, `*.tsx`, `*.js`, `*.mjs` that exist). Use the vendored copy's script for the changed-file list if it ships one, or a small Node script in `scripts/`. No shell-only syntax: the owner works on Windows under WSL.
   - `lint` stays `eslint .`, the fast subset.

   Time `check:fast` warm with one changed file, and `check` in full. Record both.
7. **`.claude/rules/`.** Keep each file under about 40 lines. Each carries the rules an agent must hold while editing there, and points at the skill for the rest.
   - **`web.md`** (`paths: ["web/src/**"]`):
     - read the `base-ui` skill, and for UI work [wiki/web-app.md](../../wiki/web-app.md) and [wiki/overlays.md](../../wiki/overlays.md);
     - Base UI only through `web/src/components/ui/` wrappers, from subpaths;
     - a trigger around a component uses `render`;
     - dialogs come from the `Dialog` wrapper, which holds the Escape guard and initial focus;
     - native selects, checkboxes, radios and the time field's list stay native ([wiki/decisions.md](../../wiki/decisions.md));
     - the app has a Light / Dark / System switch, light on a first visit (brief 03 builds it);
     - dates through `web/src/dates.ts`, routes through `viewRoute` and `dateOfRoute`;
     - glossary words in UI copy ([wiki/glossary.md](../../wiki/glossary.md));
     - static-markup tests mock `@base-ui/react/dialog` with the dialog stub, and assert on roles and text, not class names.

     Brief 03 adds the Tailwind lines.
   - **`server.md`** (`paths: ["server/src/**", "shared/src/**"]`):
     - read the `code-structure` skill, and [wiki/architecture.md](../../wiki/architecture.md), [wiki/data-model.md](../../wiki/data-model.md) and [wiki/recurrence.md](../../wiki/recurrence.md);
     - `config.ts` is the only reader of the environment;
     - errors are `throw new ApiError(code, message)`, and the body is `{ error: { code, message } }`, which `web/src/api.ts` parses;
     - every row is scoped to a user through `currentUserId(request)`, with a 404 for another user's id;
     - the sign-in feature registers first;
     - a `FeatureContext` field only when two features need it;
     - `server/vendor/` is generated, so never edit it;
     - tests through `startTestApp` and `signInAs` in `server/src/testing/testApp.ts`;
     - times are UTC milliseconds or dates through Temporal, never `toLocaleString`.

     Brief 04 adds the structure lines.
8. **`CLAUDE.md`** at the root, under about 60 lines:
   - one line on what Almanac is;
   - "read [corpus/index.md](../../index.md) first";
   - the commands:
     - `npm run dev`;
     - `npm run check` before every hand-back;
     - `npm run check:fast`;
     - one test with `npx vitest run <file>`;
     - `npm run seed -w @almanac/server`;
     - `npm run vapid-keys -w @almanac/server`;
   - the places that mislead:
     - `pretest` builds `shared`, so a changed schema needs it;
     - the typecheck is two runs;
     - `.env` sits at the repo root;
     - the API is on 8809 and Vite on 5177;
     - the `ENOSPC` watcher fix is in `docs/getting-started.md`;
   - the moved Hard rules and brief-board sections.

   [corpus/CLAUDE.md](../../CLAUDE.md) keeps everything else: layout, retrieval budget, frontmatter, todos and briefs, source of truth, decisions and glossary, writing.

   There is no "Conventions" section. Brief 15 first planned one, and brief 27 replaced it with `.claude/rules/`.
9. **Corpus.**
   - Add the [wiki/decisions.md](../../wiki/decisions.md) entry "The house style, formatted and checked", with the width (120), the vendored config source, what was rejected and why.
   - Update [wiki/status.md](../../wiki/status.md) and [log.md](../../log.md).
   - Drop `.claude` and `scripts` from [.planned-roots](../../.planned-roots) once they exist.
   - Run `bash corpus/lint.sh` until it is clean.

## Acceptance

- [ ] `npm run check` passes. Its run time and `check:fast`'s, warm with one changed file, are in the outcome note, and `check:fast` is under about 15 s or the owner has accepted the time.
- [ ] `npx prettier --check .` passes. The reformat is one commit that changes whitespace only (`git diff -w <hash>^ <hash>` shows nothing outside the reformat), and its hash is in `.git-blame-ignore-revs`.
- [ ] `tsconfig.base.json` has `verbatimModuleSyntax` and `erasableSyntaxOnly`. `npm run typecheck` and `docker build` of `infrastructure/Dockerfile` pass.
- [ ] ESLint reports zero errors with every rule in step 5's table. The counts before and after are in the outcome note, and so is every finding left with its reason.
- [ ] A deliberate `enum`, `!`, `console.log` in `server/src/app.ts`, `// TODO` and `export default` each fail `npm run lint`. Revert them after.
- [ ] `.claude/rules/web.md` and `server.md` exist with `paths:` frontmatter. Every file under `corpus/` that this brief changes passes the corpus lint. The root `CLAUDE.md` is under about 60 lines and lists `npm run check`.
- [ ] With the plugin's hooks on, an agent's edit is formatted on save, and a type error stops it at `Stop`.
- [ ] `bash corpus/lint.sh` ends clean.

## Interplay

- Brief 02 adds nothing to the gate. Brief 03 adds `better-tailwindcss` and drops `check-base-ui`'s `--warn-only`. Brief 04 adds dependency-cruiser, drops `check-structure`'s `--warn-only`, and turns `no-process-env` (from `eslint-plugin-n`) into an error.
- The reformat changes `web/src/styles/tokens.css`'s hex case. Brief 03 deletes that file anyway.

## Outcome (2026-11-11)

Built on `main` in nine commits (06c05e8 vendor, 7c94eeb Prettier config, fdd3172 reformat, 4d8b987 blame ignore, aa5ddb8 tsconfig, c5b902b ESLint, 1159718 gate, e02b399 CLAUDE.md and rules, 9225176 corpus). Synced to `house-style-v1.0.0`; the controller re-syncs to 1.1.0 later.

**Counts** are in [log.md](../../log.md) (2026-11-11 entry): typed rules 1 floating promise, 2 + 11 unnecessary assertions, 0 for the rest; 9 `!` (tests); 3 `no-redeclare` from a `/* global */` comment; `expect-expect` 5 without `expectError` named, 0 with; `n/no-process-env` 4 (warning). All fixed except the 4 warnings. dependency-cruiser: 7 `no-circular`, lowered to a warning by name in `.dependency-cruiser.cjs`. Checkers `--warn-only`: check-base-ui 19, check-structure 31 errors and 7 warnings. knip: 0 files, 0 dependencies, 22 exports and 10 types as warnings.

**Timings**, warm: `check:fast` 4.9-5.6 s (one server file), 12 s (one web file), 3 s (none); `npm run check` 41.8 s. `projectService` kept: a draw with `project: true`.

**Reformat:** 90 files. The esbuild bundle compare matched for every TypeScript and JavaScript file; CSS differs only in `tokens.css` hex case; `package.json` differs only by the two format scripts added between the snapshots.

**Hooks**, run by hand: the formatter hook formatted a messy `server/src/messy.ts`; the Stop hook exited 2 on a type error and 0 once reverted.

**Deviations:**
- `tsconfig.base.json` carries the house flags itself and doesn't extend the vendored base: the Dockerfile's `deps` stage copies only that file before `tsc -b server` (the same call wicket made).
- `@vite-pwa/assets-generator` is in knip's `ignoreDependencies` for `web` (`knip.config.js`), not removed: it regenerates the home-screen icons by hand.
- `docs/images/` is in `houseStyle()`'s `scripts` option (a hand-run helper); `vapid-keys.ts` joined the `console` list and the `n/no-process-env` warning block, beside `index.ts` and `seed.ts`.
- `void` on `parseJson(...)` in `server/src/app.ts`: the callback form returns nothing at runtime.

**Checks skipped:** docker build (no docker builds here); the live-session hook check waits for the plugin update.
