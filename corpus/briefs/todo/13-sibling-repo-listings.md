# Task 13: Fix the stale app lists in sibling repos

## Context

Promoted 2026-10-23 from the todo
[sibling-repo-listings](../../todos/sibling-repo-listings.md), found by brief 11.
None of it blocks Almanac; it is housekeeping in other repos after Shelfmark and
Almanac joined the estate.

Rechecked 2026-10-23:

- `../wzd_auth/README.md`: the status paragraph (around line 11) names the apps
  that offer "Sign in with Ward" and stops before Shelfmark and Almanac; the
  console screenshot's alt text (line 43) says "six registered apps".
- `../wzd_auth/docs/cutover-oidc.md`: the redirect-URI table (around line 199)
  stops at satchel. Shelfmark and Almanac use the same `WARD_OIDC_*` settings
  (both have them in `.env.example` and `server/src/config.ts`).
- `../shelfmark/docs/owner-setup.md` step 5, "Redeploy Ward's UI, so its login
  allowlist knows `/shelfmark/`", is obsolete since Ward brief 30 (`?next=` now
  accepts only Ward's own pages).
- `../vps-deploy/corpus/wiki/status.md`: **already fixed** (it now says 39 stacks).
  Nothing to do there.

Ward moved to its own host in Ward brief 32 (`ward.<domain>`). Where a line you
edit names the old `/ward/` path, follow what the surrounding page now says
rather than mixing the two.

This brief edits files in two other repos. Each repo gets its own commit, in that
repo's style, on its own `main`.

## Files you OWN

- `../wzd_auth/README.md` (the status paragraph and the screenshot alt text)
- `../wzd_auth/docs/cutover-oidc.md` (the redirect-URI table and any count beside it)
- `../shelfmark/docs/owner-setup.md` (step 5, and the numbering after it)
- corpus: this brief's outcome, `status.md`, `log.md`

## Files you must NOT touch

- Any code, config or `.env` in either repo.
- `../wzd_auth/docs/images/`: if the console screenshot is now wrong too, say so
  in the outcome (that repo's `docs/images/shots.md` says how to redo it); don't
  recapture it here.

## What to do

1. Read each app's real redirect path from its server config before writing the
   rows: `../shelfmark/server/src/config.ts` and `server/src/config.ts` here. Don't
   guess from the other rows' pattern.
2. Add the two rows to the cutover table, and the two apps to the README's list.
   Make the alt text say what the screenshot shows (it is a picture of six apps,
   so either describe it as it is or drop the count).
3. Delete shelfmark's step 5 and renumber.
4. Commit in each repo separately.

## Acceptance

- `grep -n "six registered" ../wzd_auth/README.md` finds nothing, or finds text that
  matches the screenshot.
- The cutover table has a row each for shelfmark and almanac whose redirect URI
  matches that app's config.
- Shelfmark's owner steps no longer ask to redeploy Ward's UI.
- Each touched repo's own lint passes, where it has one for docs
  (`bash corpus/lint.sh` does not cover `docs/`).
