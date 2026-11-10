# Task 01: The house style and the quality harness

**Depends on:**

- In Almanac: nothing. This brief runs first.
- In the owner's skills library:
  - brief 27, *A house style, and a quality harness that enforces it*: the `house-style` package at `v1.0.0`, the `house-style` skill, and the plugin's `Stop` and `PostToolUse` hooks;
  - brief 15, *Enforce the base-ui and code-structure skills in every repo*: how the convention checkers are wired and when they run `--warn-only`.
- The owner's grilling of 2026-11-10, questions Q5-Q14 of the skills library's open questions.

**Runs before:** 02, 03 and 04. The reformat touches 70 TypeScript files, and those three briefs rewrite or move most of them. Formatting first gives one clean reformat commit, and the formatter hook keeps every later diff formatted.

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

**Prettier churn.** Defaults (double quotes, semicolons), `trailingComma: "all"`, on the 164 TypeScript and JavaScript files (23,060 lines):

| `printWidth` | Lines changed | Files changed |
|---|---|---|
| 100 | 1,343 (5.8%) | 139 |
| 110 | 864 (3.7%) | 119 |
| 120 | 502 (2.2%) | 93 |
| **130** | **333 (1.4%)** | **70** |
| 140 | 350 (1.5%) | 61 |

130 is Almanac's least churn. Brief 27 measured about 340 lines in 70 files.

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
  - expect zero, and confirm it in step 3.

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

**Not measured here:** the six typed rules' finding counts, lint time with `projectService` against `project`, and knip's findings. Each needs `node_modules`. Step 1 measures them.

Two leads:

- The code already marks discarded promises: 16 `void` calls in `server/src` and `web/src`.
- knip should report `@vite-pwa/assets-generator` in `web/package.json` as unused. No script, config or doc names it; it was used by hand for the home-screen icons.

## Owner decisions (defaults this brief builds)

1. **Where the configs come from** (skills library Q6, brief 27 decision 1). Default: the `house-style` package, extended from Almanac's configs.

   Almanac adds a constraint. The Docker `deps` stage runs a full `npm ci` without `git`, and `server/tsconfig.json` would extend the package's base. A `github:` dependency needs git there.

   Default within that: depend on the tagged GitHub tarball URL, which npm fetches without git. If the owner prefers `github:`, add `git` to the `deps` stage's `apk add` line in the same commit. If Q6 goes the other way (configs copied into the repo), the same rules land as local files with a version header. Steps 3-5 don't change.
2. **Width** (Q8). Default: the estate's one width. If the estate width isn't settled when this runs, use 130, Almanac's least churn, and record it.
3. **Markdown stays out of Prettier.** Default: `.prettierignore` lists `*.md`. The corpus is prose that `corpus/lint.sh` governs, and the 93 changed lines are list and emphasis marker swaps, not fixes. *New question for the grilling.*
4. **tsconfig** (Q11). Default: add `verbatimModuleSyntax` and `erasableSyntaxOnly`, and not `exactOptionalPropertyTypes`.
5. **Typed lint** (Q12). Default: the six rules through `projectService`, unless `project` measures faster.
6. **The house shapes as errors** (Q13). Default: all of them are errors. The nine `!` in `reminders.test.ts` are fixed, not excepted. `no-process-env` (from `eslint-plugin-n`) starts as a **warning**, because its four findings are brief 04's work, and brief 04 turns it into an error.
7. **`check:fast`** (Q10). Default: a typecheck plus ESLint on the changed files, under about 15 s warm with one changed file.
8. **The Claude Code layer** (Q7). Default: the plugin's hooks. If the owner chooses committed hooks instead, add them to `.claude/settings.json` here.
9. **A root `CLAUDE.md`.** Default: create one, and move the repo-wide **Hard rules** and **brief-board** sections out of [corpus/CLAUDE.md](../../CLAUDE.md) into it, because they apply outside the corpus. *New question for the grilling.*

## Files you OWN

- `tsconfig.base.json`, and `web/tsconfig.json` (only to add `incremental` with a `tsBuildInfoFile`).
- `eslint.config.js`.
- New: the Prettier config, `.prettierignore` and `.git-blame-ignore-revs`.
- The root `package.json` (scripts, devDependencies) and `package-lock.json`.
- The reformat itself: whitespace-only changes to every file Prettier covers.
- The fixes the new rules ask for:
  - `server/src/errors.ts` (the parameter property);
  - `server/src/reminders/reminders.test.ts` (the nine `!`);
  - anything else a typed rule finds, fixed or listed in step 4.
- New: `.claude/rules/web.md`, `.claude/rules/server.md`, `CLAUDE.md`.
- [corpus/CLAUDE.md](../../CLAUDE.md): its Hard rules and brief-board sections move out.
- `scripts/conventions.json` (new, brief 15's exceptions file), if an exception is needed.
- `infrastructure/Dockerfile`: only the `apk add` line, and only under decision 1's `github:` branch.
- Corpus:
  - [wiki/decisions.md](../../wiki/decisions.md): a new entry;
  - [wiki/status.md](../../wiki/status.md);
  - [log.md](../../log.md);
  - [.planned-roots](../../.planned-roots): drop `.claude` and `scripts` once they exist.

## Files you must NOT touch

- Behaviour. Apart from the fixes listed above, every change is formatting or configuration.
- `server/vendor/` and `web/vendor/`. They are generated copies of the Ward library, and both are ignored by ESLint and Prettier.
- The layout of `server/src` and the CSS, which are briefs 04 and 03.
- The skills library and the `house-style` repo. A rule that seems wrong for Almanac is reported back, not patched locally.

## What to do

One commit per step, each with `npm run typecheck`, `npm test`, `npm run lint` and `npm run build` green.

1. **Measure first.** Record these in the `log.md` entry:
   - the six typed rules' counts (`no-floating-promises`, `no-misused-promises`, `await-thenable`, `switch-exhaustiveness-check`, `no-unnecessary-type-assertion`, `consistent-type-imports`);
   - lint time with `projectService` against `project`;
   - `npx knip` from the `house-style` preset;
   - the `tsc` counts with the two new flags;
   - `@vitest/eslint-plugin` recommended's count, with `assertFunctionNames: ["expect", "expectError"]`. Three test files use an `expectError` helper.

   Any rule that finds more than about 20 real problems, or mostly false ones, goes back to the owner before it is turned on (brief 27's rule: bring it, don't loosen it).
2. **Prettier, and the reformat.**
   1. Add `prettier` (pinned) and the config: `printWidth` per decision 2, `trailingComma: "all"`, and the rest default.
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
3. **tsconfig.** Add `verbatimModuleSyntax` and `erasableSyntaxOnly` to `tsconfig.base.json`.
   - Fix `ApiError` with a declared field assigned in the constructor. Its behaviour and the `readonly` stay.
   - Fix whatever `verbatimModuleSyntax` reports, with inline `type` imports, the house's `import { type X }`.
   - Add `"incremental": true` and a `tsBuildInfoFile` under `node_modules/.tmp/` to `web/tsconfig.json`, so the web typecheck is fast on a second run.
   - The Dockerfile's `npx tsc -b server` must still build.
4. **ESLint.** Extend the house config (decision 1), passing Almanac's roots:
   - web is `web/src`;
   - server is `server/src`;
   - the CLIs are `server/src/seed.ts`, `server/src/vapid-keys.ts`, `server/src/index.ts` (later `server.ts`) and `docs/images/*.mjs`.

   The diff in effect, against today's config:

   | Rule | Today | After | Findings today |
   |---|---|---|---|
   | the six typed rules above | off | error, through `projectService` | step 1 |
   | `@typescript-eslint/no-non-null-assertion` | off | error | 9 (fix them) |
   | `no-restricted-syntax` on `TSEnumDeclaration` | off | error | 0 |
   | `no-warning-comments` (`todo`, `fixme`), pointing at `corpus/todos/` | off | error | 0 |
   | `no-console` outside the CLIs | off | error | 0 (all 8 calls are in the CLI files) |
   | `no-default-export` (from `eslint-plugin-import-x`) outside `*.config.*` | off | error | 0 (all 3 are configs) |
   | `no-process-env` (from `eslint-plugin-n`) on `server/src` outside `config.ts` and tests | off | **warn**; brief 04 makes it an error | 4: `index.ts:17`, `seed.ts:61, 62, 68` |
   | `@vitest/eslint-plugin` recommended on `*.test.{ts,tsx}` | off | error | step 1 |
   | `no-explicit-any`, `ban-ts-comment` (only `@ts-expect-error` with a description) | error (recommended) | unchanged | 0 |
   | `react-hooks` recommended on `web/src` (7.1.1, with the compiler rules) | on | unchanged | 0 |
   | `better-tailwindcss` | absent | brief 03 adds it | |

   Typed linting needs `allowDefaultProject` for the files no tsconfig includes: `vitest.config.ts`, `eslint.config.js` and `docs/images/*.mjs`. The root `tsconfig.json` has `files: []`. `web/public/sw.js` and the `.mjs` files take `disableTypeChecked`. Fix what the typed rules find, or list each finding left, with its reason, in the outcome note.
5. **The gate.** In the root `package.json`:
   - `check` runs:
     - `typecheck`;
     - `lint`;
     - `format:check`;
     - `check:conventions`;
     - `test`.

     `check:conventions` is knip, plus the two convention checkers from the `house-style` package (or `scripts/`, under brief 15's copied-files plan). `check-base-ui` runs `--warn-only` until brief 03 is done, and `check-structure` `--warn-only` until brief 04 is done. dependency-cruiser joins in brief 04, where the layout it checks appears.
   - `check:fast` runs `typecheck`, then ESLint on the files changed against `HEAD` plus untracked ones (`*.ts`, `*.tsx`, `*.js`, `*.mjs` that exist). Use the package's script for the changed-file list if it ships one, or a small Node script in `scripts/`. No shell-only syntax: the owner works on Windows under WSL.
   - `lint` stays `eslint .`, the fast subset.

   Time `check:fast` warm with one changed file, and `check` in full. Record both.
6. **`.claude/rules/`.** Keep each file under about 40 lines. Each carries the rules an agent must hold while editing there, and points at the skill for the rest.
   - **`web.md`** (`paths: ["web/src/**"]`):
     - read the `base-ui` skill, and for UI work [wiki/web-app.md](../../wiki/web-app.md) and [wiki/overlays.md](../../wiki/overlays.md);
     - Base UI only through `web/src/components/ui/` wrappers, from subpaths;
     - a trigger around a component uses `render`;
     - dialogs come from the `Dialog` wrapper, which holds the Escape guard and initial focus;
     - native selects, checkboxes, radios and the time field's list stay native ([wiki/decisions.md](../../wiki/decisions.md));
     - light only, no dark variant;
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
7. **`CLAUDE.md`** at the root, under about 60 lines:
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
8. **Corpus.**
   - Add the [wiki/decisions.md](../../wiki/decisions.md) entry "The house style, formatted and checked", with the width, the config source, what was rejected and why.
   - Update [wiki/status.md](../../wiki/status.md) and [log.md](../../log.md).
   - Drop `.claude` and `scripts` from [.planned-roots](../../.planned-roots) once they exist.
   - Run `bash corpus/lint.sh` until it is clean.

## Acceptance

- [ ] `npm run check` passes. Its run time and `check:fast`'s, warm with one changed file, are in the outcome note, and `check:fast` is under about 15 s or the owner has accepted the time.
- [ ] `npx prettier --check .` passes. The reformat is one commit that changes whitespace only (`git diff -w <hash>^ <hash>` shows nothing outside the reformat), and its hash is in `.git-blame-ignore-revs`.
- [ ] `tsconfig.base.json` has `verbatimModuleSyntax` and `erasableSyntaxOnly`. `npm run typecheck` and `docker build` of `infrastructure/Dockerfile` pass.
- [ ] ESLint reports zero errors with every rule in step 4's table. The counts before and after are in the outcome note, and so is every finding left with its reason.
- [ ] A deliberate `enum`, `!`, `console.log` in `server/src/app.ts`, `// TODO` and `export default` each fail `npm run lint`. Revert them after.
- [ ] `.claude/rules/web.md` and `server.md` exist with `paths:` frontmatter. The root `CLAUDE.md` is under about 60 lines and lists `npm run check`.
- [ ] With the plugin's hooks on, an agent's edit is formatted on save, and a type error stops it at `Stop`.
- [ ] `bash corpus/lint.sh` ends clean.

## Interplay

- Brief 02 adds nothing to the gate. Brief 03 adds `better-tailwindcss` and drops `check-base-ui`'s `--warn-only`. Brief 04 adds dependency-cruiser, drops `check-structure`'s `--warn-only`, and turns `no-process-env` (from `eslint-plugin-n`) into an error.
- The reformat changes `web/src/styles/tokens.css`'s hex case. Brief 03 deletes that file anyway.
