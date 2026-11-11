---
paths:
  - "web/src/**"
---

# The web app (`web/src`)

- Read the `base-ui` skill before you add or change a component. For UI work
  also read [wiki/web-app.md](../../corpus/wiki/web-app.md) and
  [wiki/overlays.md](../../corpus/wiki/overlays.md).
- Base UI is imported only from subpaths (`@base-ui/react/dialog`), and only by
  the wrappers in `web/src/components/ui/`. Pages import the wrapper, never
  `@base-ui/react`.
- A trigger around one of our components uses `render`, never a wrapping
  `span` or `div`.
- Dialogs come from the `Dialog` wrapper, which holds the Escape guard and the
  initial focus.
- Native selects, checkboxes, radios and the time field's list stay native
  ([wiki/decisions.md](../../corpus/wiki/decisions.md)).
- The app gets a Light / Dark / System switch, light on a first visit. It is
  light only until that lands.
- Dates go through `web/src/dates.ts`, routes through `viewRoute` and
  `dateOfRoute`.
- UI copy uses the words of [wiki/glossary.md](../../corpus/wiki/glossary.md).
- `web/vendor/` holds Ward's generated client. Never edit it.
- Static-markup tests mock `@base-ui/react/dialog` with
  `web/src/components/dialog-stub.ts` and assert on roles and text, never on
  class names.
- `npm run check:conventions` runs `check-base-ui` over this folder,
  `--warn-only` until the Base UI and Tailwind work lands.
