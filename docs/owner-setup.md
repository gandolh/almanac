# Owner setup

Everything you do by hand to put Almanac on the VPS. Nothing in the repo
deploys or writes a secret for you. Commands run on your machine unless a step
says otherwise. The deploy builds the API image on the VPS. Running it on your
own machine is in [getting-started.md](getting-started.md).

`<production origin>` below means `https://` plus your site's host, with no path.

## 1. Register Almanac in production Ward

The adoption guide is `../wzd_auth/shared-library/README.md`. Shelfmark was
registered the same way.

1. Open `/ward/console` on the production site and sign in as the break-glass
   superuser.
2. Create an app with slug `almanac` and name `Almanac`, with public
   registration closed.
3. Make the client's key pair, from Ward's repo root:

   ```
   cd ~/projects/wzd_auth && npm run oidc-client-key --workspace=api -- almanac
   ```

   It prints a private `WARD_OIDC_CLIENT_KEY=...` line and a public JWK. Keep
   the private line for step 2. Never paste it into Ward.
4. On the app's page, under "Sign in with Ward", register a client with the
   public JWK and these addresses:
   - redirect URI: `<production origin>/almanac-api/auth/ward/callback`
   - sign-out return URI: `<production origin>/almanac/`

## 2. Write the deploy secrets

Create `~/projects/vps-deploy/secrets/almanac.env` with one line, then
`chmod 600` it:

```
WARD_OIDC_CLIENT_KEY=<the private key from step 1>
```

That is the only secret Almanac needs to start. Notifications add a second,
optional one (step 8). The deploy adds everything else (the origin, the other
Ward settings, the trusted proxy range). Without the key the
`server` step stops and names it. The dry run in step 4 shows that before you
deploy.

## 3. Check the container locally

Docker Desktop's WSL integration must be on. From the repo root, using a
scratch data directory so the container does not write into your dev database:

```
touch infrastructure/.env
ALMANAC_DATA_DIR="$(mktemp -d)" docker compose -f infrastructure/docker-compose.yml up --build -d
curl -s http://127.0.0.1:8797/api/health
```

Expect `{"status":"ok"}`. Stop it with:

```
docker compose -f infrastructure/docker-compose.yml down
```

`infrastructure/.env` is git-ignored, and the scratch directory sits under
`/tmp`. Delete both afterwards if you like.

## 4. Deploy

Dry run first. It prints every action and runs none. If step 2 is not done,
it stops at the missing key:

```
cd ~/projects/vps-deploy
node cli.ts almanac all --dry-run
```

Then the real one. It asks for the server sudo password once, builds the web
app, ships it, and builds and starts the API container:

```
node cli.ts almanac all
```

Later updates:

```
node cli.ts almanac deploy   # the web app
node cli.ts almanac server   # the API container
```

Check that the container is healthy and the app is served:

```
curl -s <production origin>/almanac-api/api/health
curl -sI <production origin>/almanac/
```

The first prints `{"status":"ok"}`; the second returns `200`.

## 5. Create your account

There is no register page. Run the seed inside the container on the VPS. It
asks for the username and password and shows neither on screen, so nothing is
stored or lands in shell history. The password needs at least 8 characters:

```
ssh hetzner-svc
export DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock
cd /srv/almanac-api
docker compose -f infrastructure/docker-compose.yml exec -it almanac-api node server/dist/seed.js
```

If you would rather pass them, add `-e SEED_USERNAME=<name> -e SEED_PASSWORD=<password>`
after `exec`, and keep the command out of any file. An existing user is left as
it is, password included. Run it again with another name to add another local
user.

After your first sign-in, check that the login lockout sees each visitor's own
address. Under rootless Docker, Caddy may reach the container from an address
outside `172.16.0.0/12`, the range vps-deploy trusts:

```
docker compose -f infrastructure/docker-compose.yml logs almanac-api | grep -i "X-Forwarded-For ignored"
```

No output is right. If the line shows up, every visitor shares one lockout
counter, so five wrong passwords from anyone lock everyone out for a while.
The line names the address Caddy came from; add that range to `TRUSTED_PROXIES`
in vps-deploy's `stacks/ward.ts`, which every app on the box shares, and deploy
again.

## 6. Let Ward accounts in

In Ward's console, open the `almanac` app and grant a role on it to your own
Ward account, and to anyone else who should have a calendar of their own.
Without a grant Ward refuses the sign-in.

Link your own accounts in this order, or you end up with two users:

1. Sign in with the local account from step 5.
2. In the account menu, use "Sign in with Ward" to link your Ward account to it.

Anyone else you grant signs in with the "Sign in with Ward" button on the login
page. Almanac makes them a user of their own on the first sign-in, with an
empty calendar. Nobody can see anyone else's calendar.

## 7. Open it on the phone

Open `<production origin>/almanac/` in the phone's browser and sign in. Then add
it to the home screen: on Android Chrome use the menu, then Add to Home screen
(or Install app, if the menu offers it); on iPhone Safari use Share, then Add to
Home Screen. The icon opens Almanac without the browser's address bar.

## 8. Turn on notifications

Almanac can show a notification on a phone or a computer with the app closed:
"Send a test" in the account menu's Notifications now, event reminders once
those are built. The server signs every push with a VAPID key pair. Without
the pair it starts with notifications off and says so once in its log;
everything else works as before.

1. **Make a pair,** once, from the repo root:

   ```
   npm run vapid-keys -w @almanac/server -- --print
   ```

   It prints three lines: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and
   `VAPID_SUBJECT`. The private key is a secret: keep it out of the repo, out
   of chats and out of shell history. `VAPID_SUBJECT` comes out as the
   placeholder `mailto:johndoe@example.com`. Replace it with an address push
   services can reach you at, as a `mailto:` URL.

2. **Pass them to the container.** The deploy doesn't do this yet:
   `../vps-deploy/stacks/almanac.ts` sends the container no `VAPID_*` value.
   Satchel's stack (`stacks/satchel.ts`) shows the three lines it needs, read
   with `estate.secret("almanac", ...)`. Then add the three lines to
   `~/projects/vps-deploy/secrets/almanac.env`, next to the Ward key.

3. **Redeploy both halves:**

   ```
   cd ~/projects/vps-deploy && node cli.ts almanac all
   ```

   `server` restarts the API with the keys and `deploy` ships the web app with
   its service worker, `sw.js`. The worker handles pushes only and caches
   nothing, so the app still loads from the network every time.

4. **Turn it on, per device:** the account menu, then Notifications. On an
   iPhone, web push works only in the Home Screen app (iOS 16.4 or later), so
   add Almanac to the Home Screen first (step 7), open it from the icon and
   turn Notifications on there. Android and desktop browsers need no such
   step. Press "Send a test" to check.

Keep the pair. A new one turns notifications off on every device until each
turns them on again.

## Local development

Moved to [getting-started.md](getting-started.md): install, the seed, `npm run
dev`, "Sign in with Ward" against the local Ward, the checks, and the `ENOSPC`
workaround.
