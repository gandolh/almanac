# README images

How each image was made, so the next refresh is a re-run. Re-take an image
when the screen it shows changes.

All of them come from the repo running `npm run dev` against a scratch
`DATA_DIR`, signed in as a made-up `demo` account and filled by
[demo-seed.mjs](demo-seed.mjs). Every event, place and name in it is invented.
The seed places events around the week it runs in, so a new capture shows a
different month with the same shape.

| File | Shows | How to reach that state | Viewport | Taken |
|---|---|---|---|---|
| hero.webp | Month view with the four calendars and today's list | Fresh seed, sign in, `/almanac/` opens on the month | 1440×900 @2x, scaled to 1600 px wide | 2026-11-16 |
| week.webp | Week view with the now chip, today's column and today's list | Same, press `w` | 1440×900 @2x, scaled to 1600 px | 2026-11-16 |
| year.webp | Year view with dots on days that have events | Same, press `y` | 1440×900 @2x, scaled to 1600 px | 2026-11-16 |
| event-form.webp | The Edit event form for the Swimming series, reminder set to 30 minutes before | Week view, click Tuesday's Swimming, then Edit; pick "30 minutes before" under Reminder without saving; screenshot the `[role="dialog"]` element | 1440×900 @2x, crop scaled to 900 px | 2026-11-16 |
| phone-week.webp | The phone's week strip over the week's list, with the bottom bar and Create | `iPhone 14` device, sign in, open `/almanac/week/<y>/<m>/<d>` | iPhone 14, 390×664 @3x, scaled to 780 px | 2026-11-16 |
| phone-month.webp | Month view at phone size | Same device, `/almanac/` opens on the month | iPhone 14, 390×664 @3x, scaled to 780 px | 2026-11-16 |

The week view opens scrolled to 08:00 and reaches 23:00 in a 900 px tall
window, so take it between those hours to have the now chip on screen.

All six show the light theme, which a first visit gets.

## Demo data

1. In a checkout with `npm ci` done, leave out `.env`, or copy
   `.env.example`, so no Ward values are read.
2. Create the account with the password only in the environment, then start
   the app on a scratch data folder:

   ```bash
   export DATA_DIR=/tmp/almanac-demo
   read -rs -p 'Demo password: ' ALMANAC_PASSWORD && export ALMANAC_PASSWORD
   SEED_USERNAME=demo SEED_PASSWORD="$ALMANAC_PASSWORD" npm run seed -w @almanac/server
   npm run dev
   ```

   On 2026-11-16 the app ran on other ports (API 6101, Vite 6100), started
   as two halves the way
   [getting-started.md](../getting-started.md#common-problems) shows, and
   the password was a random value made with `openssl rand -hex 12` in the
   environment.

3. From another terminal, with the same `ALMANAC_PASSWORD`:

   ```bash
   ALMANAC_USER=demo node docs/images/demo-seed.mjs
   ```

   It adds Work, Sport and Birthdays beside Personal, four repeating events,
   four yearly birthdays and about two dozen one-off events, and prints how
   many it made. Give it the API's address as an argument when the API is not
   on 8809 (`http://127.0.0.1:6101` on 2026-11-16).

## Capture method

- Browser: on 2026-11-16, Playwright's Chromium from a script outside the
  repo, a 1440×900 @2x context for desktop and the `iPhone 14` device for the
  phone, time zone Europe/Bucharest, locale en-GB, light colour scheme.
  Chromium ran with `--lang=en-GB` and `LANG=en_GB.UTF-8` in its environment,
  so the form's date fields read 17/11/2026, not 11/17/2026. Sign in through
  the login page once per context; the session cookie carries over. Captures
  up to 2026-10-31 used the same sizes, from Playwright or
  `agent-browser --session almanac-readme`.
- The shortcuts reach the app only once focus leaves the sign-in form: click
  the empty page ground first.
- Stills: PNG to WebP with
  `ffmpeg -i in.png -vf scale=1600:-1:flags=lanczos -c:v libwebp -quality 82 out.webp`
  (780 for the phone). The form is a screenshot of the
  `[role="dialog"]` element, scaled with `-vf scale=900:-1:flags=lanczos`.
- Close the event form with Cancel or Escape after the capture, so nothing in
  the scratch data changes.
- `web/e2e/shots.spec.ts` (`SHOTS_DIR=<folder> npx playwright test shots`)
  takes the design board's captures from stubbed fixtures. These README images
  come from the real API and the demo seed instead.
