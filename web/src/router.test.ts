import { afterEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "temporal-polyfill";
import {
  HOME,
  LOGIN,
  SEARCH,
  dateOfRoute,
  goBack,
  hrefFor,
  isViewRoute,
  lastViewRoute,
  matchRoute,
  navigate,
  navigateToSearch,
  pathFor,
  queryString,
  rememberViewRoute,
  replaceWithCanonical,
  route,
  ROUTES,
  sameRoute,
  viewRoute,
  type Route,
} from "./router";

const BASE = "/almanac/";

describe("matchRoute", () => {
  it("matches home and login", () => {
    expect(matchRoute("/almanac/", BASE)).toEqual(HOME);
    expect(matchRoute("/almanac", BASE)).toEqual(HOME);
    expect(matchRoute("/almanac/login", BASE)).toEqual(LOGIN);
    expect(matchRoute("/almanac/login/", BASE)).toEqual(LOGIN);
  });

  it("forgives doubled slashes", () => {
    expect(matchRoute("/almanac//login", BASE)).toEqual(LOGIN);
  });

  it("has no route for unknown paths, or paths outside the base", () => {
    for (const path of [
      "/almanac/nope",
      "/almanac/login/extra",
      "/almanacx/login",
      "/shelfmark/login",
      "/",
      "/almanac/month",
      "/almanac/month/2026/10",
      "/almanac/month/2026/10/16/extra",
      "/almanac/agenda/2026/10/16",
    ]) {
      expect(matchRoute(path, BASE), path).toBeNull();
    }
  });

  it("follows a different base", () => {
    expect(matchRoute("/", "/")).toEqual(HOME);
    expect(matchRoute("/login", "/")).toEqual(LOGIN);
    expect(matchRoute("/apps/almanac/login", "/apps/almanac/")).toEqual(LOGIN);
    expect(matchRoute("/apps/almanac", "/apps/almanac/")).toEqual(HOME);
    expect(matchRoute("/almanac/login", "/apps/almanac/")).toBeNull();
  });

  it("reads the base from the build when none is given", () => {
    vi.stubEnv("BASE_URL", "/elsewhere/");
    try {
      expect(matchRoute("/elsewhere/login")).toEqual(LOGIN);
      expect(matchRoute("/almanac/login")).toBeNull();
      expect(pathFor(LOGIN)).toBe("/elsewhere/login");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("matches the four views and search, parameters decoded", () => {
    expect(matchRoute("/almanac/search", BASE)).toEqual(SEARCH);
    expect(matchRoute("/almanac/day/2026/10/16", BASE)).toEqual({ name: "day", params: { y: "2026", m: "10", d: "16" } });
    expect(matchRoute("/almanac/week/2026/10/16/", BASE)).toEqual({ name: "week", params: { y: "2026", m: "10", d: "16" } });
    expect(matchRoute("/almanac/month/2026/1/5", BASE)).toEqual({ name: "month", params: { y: "2026", m: "1", d: "5" } });
    expect(matchRoute("/almanac/year/2026/10/16", BASE)).toEqual({ name: "year", params: { y: "2026", m: "10", d: "16" } });
    expect(matchRoute("/almanac/day/2026/10/%E0%A4%A", BASE)).toBeNull();
    expect(matchRoute("/almanac/day/2026/10/%20", BASE)).toBeNull();
  });

  it("takes a new route from one table line", () => {
    const table = { ...ROUTES, agenda: "/agenda/:y" };
    expect(matchRoute("/almanac/agenda/2026", BASE, table)).toEqual({ name: "agenda", params: { y: "2026" } });
  });
});

describe("pathFor", () => {
  it("writes the canonical paths", () => {
    expect(pathFor(HOME, BASE)).toBe("/almanac/");
    expect(pathFor(LOGIN, BASE)).toBe("/almanac/login");
    expect(pathFor(HOME, "/")).toBe("/");
  });

  it("writes the views' dates unpadded", () => {
    expect(pathFor(viewRoute("month", Temporal.PlainDate.from("2026-01-05")), BASE)).toBe("/almanac/month/2026/1/5");
    expect(pathFor(viewRoute("day", Temporal.PlainDate.from("2026-10-16")), BASE)).toBe("/almanac/day/2026/10/16");
    expect(pathFor(SEARCH, BASE)).toBe("/almanac/search");
  });

  it("round-trips through matchRoute", () => {
    const day = Temporal.PlainDate.from("2026-10-16");
    const routes: Route[] = [
      HOME,
      LOGIN,
      route("login", {}),
      SEARCH,
      viewRoute("day", day),
      viewRoute("week", day),
      viewRoute("month", day),
      viewRoute("year", day),
    ];
    for (const each of routes) {
      const path = pathFor(each, BASE);
      expect(path.startsWith(BASE)).toBe(true);
      expect(matchRoute(path, BASE)).toEqual(each);
    }
  });

  it("compares routes by name and parameters", () => {
    expect(sameRoute(LOGIN, route("login", {}))).toBe(true);
    expect(sameRoute(HOME, LOGIN)).toBe(false);
  });
});

describe("view routes", () => {
  it("know their view and date", () => {
    const route16 = viewRoute("week", Temporal.PlainDate.from("2026-10-16"));
    expect(route16).toEqual({ name: "week", params: { y: "2026", m: "10", d: "16" } });
    expect(isViewRoute(route16)).toBe(true);
    expect(isViewRoute(HOME)).toBe(false);
    expect(isViewRoute(SEARCH)).toBe(false);
    expect(dateOfRoute(route16)?.toString()).toBe("2026-10-16");
  });

  it("read loose but real dates, and refuse impossible ones", () => {
    const read = (y: string, m: string, d: string) => dateOfRoute({ name: "month", params: { y, m, d } })?.toString() ?? null;
    expect(read("2026", "01", "05")).toBe("2026-01-05");
    expect(read("2028", "2", "29")).toBe("2028-02-29");
    expect(read("2026", "2", "29")).toBeNull();
    expect(read("2026", "13", "1")).toBeNull();
    expect(read("2026", "0", "1")).toBeNull();
    expect(read("0", "1", "1")).toBeNull();
    expect(read("2026", "1", "1x")).toBeNull();
    expect(read("2026", "-1", "1")).toBeNull();
    expect(read("2026", "1.5", "1")).toBeNull();
    expect(read("20260", "1", "1")).toBeNull();
  });

  it("remember the last one shown, home before any", () => {
    expect(lastViewRoute()).toEqual(HOME);
    const shown = viewRoute("year", Temporal.PlainDate.from("2026-10-16"));
    rememberViewRoute(shown);
    expect(lastViewRoute()).toEqual(shown);
  });
});

describe("queries", () => {
  it("writes a query string, leaving empty values out", () => {
    expect(queryString(undefined)).toBe("");
    expect(queryString({})).toBe("");
    expect(queryString({ q: "" })).toBe("");
    expect(queryString({ q: "gym day" })).toBe("?q=gym+day");
    expect(queryString({ q: "a&b=c" })).toBe("?q=a%26b%3Dc");
    expect(hrefFor(SEARCH, { q: "Ședință" }, BASE)).toBe("/almanac/search?q=%C8%98edin%C8%9B%C4%83");
  });
});

describe("navigation", () => {
  /** A History API with entries, enough for push, replace and back. */
  function fakeWindow(start: string) {
    const entries: { path: string; state: unknown }[] = [{ path: start, state: null }];
    let index = 0;
    const events: string[] = [];
    const location = { pathname: start, search: "", hash: "" };
    const sync = () => {
      const [path = "", hash = ""] = (entries[index]?.path ?? "").split("#");
      const [pathname = "", search = ""] = path.split("?");
      location.pathname = pathname;
      location.search = search ? `?${search}` : "";
      location.hash = hash ? `#${hash}` : "";
    };
    sync();
    const history = {
      get state() {
        return entries[index]?.state ?? null;
      },
      pushState(state: unknown, _title: string, path: string) {
        entries.splice(index + 1, entries.length, { path, state });
        index += 1;
        sync();
      },
      replaceState(state: unknown, _title: string, path: string) {
        entries[index] = { path, state };
        sync();
      },
      back() {
        index -= 1;
        sync();
        events.push("popstate");
      },
    };
    vi.stubGlobal("window", {
      location,
      history,
      scrollTo: () => events.push("scroll"),
      dispatchEvent: (event: Event) => events.push(event.type),
    });
    return { entries: () => entries.map((entry) => entry.path), index: () => index, events, location };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("pushes a new entry without a reload, and skips a visit to the page you're on", () => {
    vi.stubEnv("BASE_URL", BASE);
    const win = fakeWindow("/almanac/");
    navigate(LOGIN);
    expect(win.entries()).toEqual(["/almanac/", "/almanac/login"]);
    expect(win.events).toEqual(["scroll", "almanac:navigate"]);
    navigate(LOGIN);
    expect(win.entries()).toHaveLength(2);
  });

  it("replaces the entry when asked", () => {
    vi.stubEnv("BASE_URL", BASE);
    const win = fakeWindow("/almanac/login");
    navigate(HOME, { replace: true });
    expect(win.entries()).toEqual(["/almanac/"]);
  });

  it("navigates to search with its query, and again when only the query changes", () => {
    vi.stubEnv("BASE_URL", BASE);
    const win = fakeWindow("/almanac/month/2026/10/16");
    navigateToSearch("gym");
    expect(win.entries()).toEqual(["/almanac/month/2026/10/16", "/almanac/search?q=gym"]);
    expect(win.location.search).toBe("?q=gym");
    navigateToSearch("gym");
    expect(win.entries()).toHaveLength(2);
    navigateToSearch("swim");
    expect(win.entries()).toEqual(["/almanac/month/2026/10/16", "/almanac/search?q=gym", "/almanac/search?q=swim"]);
    // Leaving search drops the query.
    navigate(viewRoute("day", Temporal.PlainDate.from("2026-10-16")));
    expect(win.entries().at(-1)).toBe("/almanac/day/2026/10/16");
    expect(win.location.search).toBe("");
  });

  it("keeps the query and hash when tidying an address", () => {
    vi.stubEnv("BASE_URL", BASE);
    const win = fakeWindow("/almanac/login/?ward_error=access_denied#top");
    replaceWithCanonical(LOGIN);
    expect(win.entries()).toEqual(["/almanac/login?ward_error=access_denied#top"]);
  });

  it("goes Back when the entry behind is where the link points, and visits it otherwise", () => {
    vi.stubEnv("BASE_URL", BASE);
    const win = fakeWindow("/almanac/");
    navigate(LOGIN);
    goBack(HOME);
    expect(win.index()).toBe(0);
    expect(win.location.pathname).toBe("/almanac/");

    // A deep link has nothing behind it.
    const deep = fakeWindow("/almanac/login");
    goBack(HOME);
    expect(deep.entries()).toEqual(["/almanac/login", "/almanac/"]);
  });
});
