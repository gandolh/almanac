# The redesign: "The week and its day"

This folder is the design record of Almanac's redesign. The estate redesign board, where it was drawn and approved, is a private canvas; this is a copy of the app's page on it plus the build behind that page. The owner approved it on 2026-11-13, and [brief 05](../../corpus/briefs/done/05-a-redesign-with-hallmark-on-the-estate-board.md) built it. The code is now the source of truth: where the app and these files differ, the app wins, and later work may have moved a screen on. Read this folder to see what was decided and why before reshaping a screen.

## The owner's decisions

The owner approved the whole board on 2026-11-13, with every question standing at what the board proposed unless they reopened it. The questions this app's page asked:

- **Ask:** 1. Reopened: Almanac stops copying Google Calendar's look (decisions.md, "Google Calendar's layout") and takes a moss accent, olive greys and Sofia Sans. The layout stays. OK? 2. Calendar colours differ per theme, with dark text on the light dark-mode fills (reopens "look the same in both themes" and shared/src/calendar.ts; the web maps keys to its own tokens, shared/ is a later brief). OK? 3. Approve The week and its day as Almanac's direction?
- **Open question:** On the phone the week becomes a day strip plus an agenda that runs through Sunday; the time grid stays in Day. The bottom view bar replaces the Week menu. Both reopen web-app.md's phone shell. Keep both?
- **Open question:** The moss accent shares its hue with the olive calendar key. The accent marks only the chosen view and day, Create, links and focus, never an event. Keep, or move the accent?
- **Reopened:** Recorded (decisions.md, 2026-10-16): "The UI copies Google's layout straight, with no design" and the calendar colours "look the same in both themes, so the text on an event is fixed." Proposed: the layout stays, the look is Almanac's own, and the text on an event is white on the light solids and near-black on the dark ones.

Where the files below disagree, the later layer wins: the owner's decisions, then the controller's rulings, then the judges' rulings, then the directions file.

## What is here

| Path | What it holds |
|---|---|
| `directions/almanac.md` | The director's brief: both directions (the winner is the one built), the shared fixture and the screens to draw. |
| `judge/almanac/RESULT.md` | The blind judging against today and the rulings that came with the win. |
| `critiques/almanac-controller.md`, `critiques/almanac.md` | The design critic's review against today, and the controller's rulings over it. |
| `manifests/almanac.tokens.css`, `manifests/almanac.tokens-map.md` | The token hand-off in the app's own names, and the renamed, new and unused tokens. |
| `manifests/almanac.board-notes.md` | What the board said beside the screens: the asks, decisions, reopened rules, open questions, the contrast table and the runner-up. |
| `work/almanac/twins/*.html` | Each drawn screen as static HTML, light and dark: open one in a browser. |
| `work/almanac/shots/` | The twins rendered at 1280 and 390, light and dark, WebP. `direction.webp` is the board's direction sheet. |
| `shots/almanac/` | Today's screens as the board showed them before the redesign. |

People's names and data in the pictures come from seeded demo accounts or are invented.

## Not here

The sketches and the judges' images, the runner-up's build (its notes are in the board's notes), the build's scripts, and the screenshots taken while it was built. They stay in the estate build folder.
