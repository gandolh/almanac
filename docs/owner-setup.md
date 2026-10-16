# Owner setup

Everything you do by hand to put Almanac on the VPS, and how to run it on your
own machine. Nothing in the repo deploys or writes a secret for you. Commands
run on your machine unless a step says otherwise. The deploy builds the API
image on the VPS. Local development is at the end of this page.

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

That is the only secret Almanac has. The deploy adds everything else (the
origin, the other Ward settings, the trusted proxy range). Without the key the
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

## Local development

Node 24 and npm. From the repo root:

```
npm install
cp .env.example .env     # the defaults work
npm run seed -w @almanac/server
npm run dev
```

The seed creates the account you sign in with. It asks on the terminal for a
username and password, or reads `SEED_USERNAME` and `SEED_PASSWORD` from `.env`
or the environment. `.env` is git-ignored; keep any real value out of
everything else. Open `http://localhost:5177/almanac/`. The API listens on
port 8809, and Vite proxies `/almanac-api` to it, so the paths match
production. The database is `data/almanac.db`.

To try "Sign in with Ward" locally, start Ward in Docker and run its seed. The
steps are in `../wzd_auth/infrastructure/local/README.md`. The seed registers
Almanac and writes the five `WARD_OIDC_*` values into this repo's `.env`;
restart `npm run dev` afterwards. Without them the login page has no Ward
button and local accounts still work.

Checks:

```
npm run typecheck
npm run lint
npm test
```
