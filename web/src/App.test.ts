import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeView } from "./App";

describe("the home placeholder", () => {
  it("says who is signed in, with Change password and Sign out", () => {
    const html = renderToStaticMarkup(createElement(HomeView, { username: "ana" }));
    expect(html).toContain(">Almanac</h1>");
    expect(html).toContain("Signed in as ana.");
    expect(html).toContain(">Change password</button>");
    expect(html).toContain(">Sign out</button>");
    expect(html).not.toContain('role="alert"');
  });

  it("says why an action failed", () => {
    const html = renderToStaticMarkup(createElement(HomeView, { username: "ana", failure: "Almanac can't be reached." }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Almanac can&#x27;t be reached.");
  });
});
