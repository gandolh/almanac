---
title: Fix the stale app counts and tables in sibling repos
created: 2026-10-16
status: promoted
tags: [later]
---

Promoted 2026-10-23 into [brief 13](../briefs/done/13-sibling-repo-listings.md).
The vps-deploy line was already fixed by then.

# Fix the stale app counts and tables in sibling repos

Brief 11 found listings outside its files that no longer match the estate
after Shelfmark and Almanac were added. None blocks Almanac.

## Context

- `../wzd_auth/README.md` line 13 and the screenshot alt text ("six
  registered apps").
- `../wzd_auth/docs/cutover-oidc.md`: the redirect-URI table stops at
  Satchel.
- `../shelfmark/docs/owner-setup.md`: the step to redeploy Ward's UI so its
  login allowlist knows the path is obsolete since Ward brief 30.
- `../vps-deploy/corpus/wiki/status.md` and `overview.md` still say 36
  stacks (now 38).
