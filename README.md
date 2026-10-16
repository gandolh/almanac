# Almanac

A personal calendar that works like Google Calendar, light theme only. Several
people can have an account, and each sees only their own calendars. A React app
on a Fastify + SQLite API.

Version 1 is being built and is not deployed yet. The plan, the decisions and
the work queue live in [corpus/](corpus/index.md).

## What it does

- Day, week, month and year views; month opens first.
- Click or drag on the grid to create an event; drag to move, drag the bottom
  edge to resize.
- Repeating events: daily, every weekday, weekly on chosen days, monthly and
  yearly, with "this event", "this and following" and "all events" edits.
- Named, coloured calendars that you can show and hide, and a search box.
- Keyboard shortcuts, and a layout that fits a phone screen.
- Sign in with a local account, or with Ward.

Import, reminders, sharing and offline use are left out of version 1. The full
list is in [corpus/wiki/features.md](corpus/wiki/features.md).

## Run it locally

```sh
npm install
cp .env.example .env   # optional, the defaults work
npm run seed -w @almanac/server
npm run dev
```

The seed step creates the account you sign in with: it asks for a username and
password on the terminal, or reads `SEED_USERNAME` and `SEED_PASSWORD` from the
environment. They are stored nowhere but the database.

Open `http://localhost:5177/almanac/`.

## Docs

- [docs/owner-setup.md](docs/owner-setup.md): the Ward registration, the first
  deploy, creating accounts, adding it to a phone, and local development in
  full.
- [corpus/](corpus/index.md): the wiki (decisions, architecture, features) and
  the briefs.
