# README images

How each image was made, so the next refresh is a re-run. Re-take an image
when the screen it shows changes.

All of them come from a throwaway clone of the repo running `npm run dev`
against a scratch `DATA_DIR`, signed in as a made-up `demo` account and filled
by [demo-seed.mjs](demo-seed.mjs). Every event, place and name in it is
invented. The seed places events around the week it runs in, so a new capture
shows a different month with the same shape.

| File | Shows | How to reach that state | Viewport | Taken |
|---|---|---|---|---|
| hero.webp | Month view with the four calendars | Fresh seed, sign in, `/almanac/` opens on the month | 1440×900 @2x, scaled to 1600 px wide | 2026-10-16 |
| week.webp | Week view with the current-time line | Same, press `w` | 1440×900 @2x, scaled to 1600 px | 2026-10-16 |
| year.webp | Year view with dots on days that have events | Same, press `y` | 1440×900 @2x, scaled to 1600 px | 2026-10-16 |
| event-form.webp | The Edit event form for the Swimming series | Week view, click Tuesday's Swimming, then the pencil; cropped to the dialog | 1440×900 @2x, crop scaled to 900 px | 2026-10-16 |
| phone-month.webp | Month view at phone size | `set device "iPhone 14"`, open `/almanac/month/<y>/<m>/<d>` | iPhone 14, 390×844 @3x, scaled to 780 px | 2026-10-16 |

Take the week view in the evening if you want the current-time line inside
the first screen; it scrolls to 08:00.

## Demo data

1. Clone the repo somewhere outside your working copy and run `npm ci` there.
   Leave out `.env`, or copy `.env.example`, so no Ward values are read.
2. Create the account with the password only in the environment, then start
   the app on a scratch data folder:

   ```bash
   export DATA_DIR=/tmp/almanac-demo
   read -rs -p 'Demo password: ' ALMANAC_PASSWORD && export ALMANAC_PASSWORD
   SEED_USERNAME=demo SEED_PASSWORD="$ALMANAC_PASSWORD" npm run seed -w @almanac/server
   npm run dev
   ```

3. From another terminal, with the same `ALMANAC_PASSWORD`:

   ```bash
   ALMANAC_USER=demo node docs/images/demo-seed.mjs
   ```

   It adds Work, Sport and Birthdays beside Personal, four repeating events,
   four yearly birthdays and about two dozen one-off events, and prints how
   many it made.

## Capture method

- Browser: `agent-browser --session almanac-readme`, `set viewport 1440 900 2`
  for desktop, `set device "iPhone 14"` for the phone, then `screenshot` with
  an absolute path. Sign in through the login page once; the session cookie
  carries over.
- Stills: PNG to WebP with
  `ffmpeg -i in.png -vf scale=1600:-1:flags=lanczos -c:v libwebp -quality 82 out.webp`
  (780 for the phone). The form crop was
  `-vf "crop=1440:1336:720:232,scale=900:-1:flags=lanczos"` on the 2880×1800
  capture.
- Close the event form with Cancel or Escape after the capture, so nothing in
  the scratch data changes.
