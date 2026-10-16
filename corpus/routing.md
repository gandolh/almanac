# Routing profile: Almanac

Read by the `orchestrate` skill at the start of a work request.

## Skill choices

| Purpose | Skill |
|---|---|
| Implement | `plan-split-dispatch` |
| Capture | `corpus-flow` |
| Query knowledge | `corpus-flow` §5 |
| Settle a design before briefs | `grill-me`, one question at a time |
| Design / UI | Google Calendar's layout played straight ([wiki/features.md](wiki/features.md)); `impeccable` only for polish, no direction round |
| Browser checks | `ui-test-plans` once the web app exists |
| Review | inline (no project reviewer yet) |
| Pre-PR | none (no remote yet) |

## Intent table

| The user says | Route to |
|---|---|
| "add a todo", "note this for later" | `corpus-flow` §1 |
| "write the briefs", "promote X" | `corpus-flow` §2 |
| "let's build brief NN", "build v1" | `corpus-flow` §3, then `plan-split-dispatch` |
| "what does the wiki say about X" | `corpus-flow` §5 |
| "grill me", "stress-test this design" | `grill-me` |
| "make the app look better" | `impeccable` |

## READ / SKIP / SKILLS

| Always READ | Always SKIP | Load SKILL |
|---|---|---|
| [index.md](index.md) | `node_modules/`, `dist/` | `corpus-flow` for any capture or completion |
| [wiki/status.md](wiki/status.md) | lockfiles, `data/` and any SQLite file | `plan-split-dispatch` for 3 or more independent chunks |
| [wiki/decisions.md](wiki/decisions.md) | `briefs/` and `todos/` wholesale | `impeccable` for visual polish |
| [wiki/features.md](wiki/features.md) before any UI brief | | |
| [wiki/glossary.md](wiki/glossary.md) | | |
| [CLAUDE.md](CLAUDE.md) hard rules | | `grill-me` before a new subsystem |

## Knowledge routing

| Question shape | Layer | Why |
|---|---|---|
| "Why is it built this way?" | `wiki/` | The corpus is the why. |
| "What does v1 include?" | [wiki/features.md](wiki/features.md) | Owns the screens and what is left out. |
| "How do repeats work?" | [wiki/recurrence.md](wiki/recurrence.md) | Owns the series model and edit scopes. |
| "Why FullCalendar?" | [wiki/research.md](wiki/research.md) | Owns the library survey. |
| "Where does feature Y live?" | `grep` | Structural. Never ask the wiki. |
| "Did I get every usage?" | `grep -rnw` | Completeness needs exhaustive search. |
| "Does the API do what the brief says?" | the tests | Behaviour is verified, not remembered. |

**Code graph:** not installed. The app will be small and `grep` is cheaper than
an index.
