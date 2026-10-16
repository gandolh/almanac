import { afterEach, describe, expect, it, vi } from "vitest";
import { HOME, LOGIN, goBack, matchRoute, navigate, pathFor, replaceWithCanonical, route, ROUTES, sameRoute, type Route } from "./router";

const BASE = "/almanac/";

describe("matchRoute", () => {
  it("matches the two routes", () => {
    expect(matchRoute("/almanac/", BASE)).toEqual(HOME);
    expect(matchRoute("/almanac", BASE)).toEqual(HOME);
    expect(matchRoute("/almanac/login", BASE)).toEqual(LOGIN);
    expect(matchRoute("/almanac/login/", BASE)).toEqual(LOGIN);
  });

  it("forgives doubled slashes", () => {
    expect(matchRoute("/almanac//login", BASE)).toEqual(LOGIN);
  });

  it("has no route for unknown paths, or paths outside the base", () => {
    for (const path of ["/almanac/nope", "/almanac/login/extra", "/almanacx/login", "/shelfmark/login", "/"]) {
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

  it("takes a new route from one table line, parameters decoded", () => {
    const table = { ...ROUTES, day: "/day/:y/:m/:d", search: "/search" };
    expect(matchRoute("/almanac/search", BASE, table)).toEqual({ name: "search", params: {} });
    expect(matchRoute("/almanac/day/2026/10/16", BASE, table)).toEqual({ name: "day", params: { y: "2026", m: "10", d: "16" } });
    expect(matchRoute("/almanac/day/2026/10/%E0%A4%A", BASE, table)).toBeNull();
    expect(matchRoute("/almanac/day/2026/10/%20", BASE, table)).toBeNull();
    // The real table has no such route.
    expect(matchRoute("/almanac/search", BASE)).toBeNull();
  });
});

describe("pathFor", () => {
  it("writes the canonical paths", () => {
    expect(pathFor(HOME, BASE)).toBe("/almanac/");
    expect(pathFor(LOGIN, BASE)).toBe("/almanac/login");
    expect(pathFor(HOME, "/")).toBe("/");
  });

  it("round-trips through matchRoute", () => {
    const routes: Route[] = [HOME, LOGIN, route("login", {})];
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
