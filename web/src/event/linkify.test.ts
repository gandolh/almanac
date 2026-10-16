import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { findLinks, linkify } from "./linkify";

function html(text: string): string {
  return renderToStaticMarkup(createElement(Fragment, null, ...linkify(text)));
}

describe("findLinks", () => {
  it("finds http and https addresses in running text", () => {
    expect(findLinks("Call on https://meet.example.com/abc-defg or http://example.org/x?y=1&z=2#top")).toEqual([
      { text: "Call on " },
      { text: "https://meet.example.com/abc-defg", href: "https://meet.example.com/abc-defg" },
      { text: " or " },
      { text: "http://example.org/x?y=1&z=2#top", href: "http://example.org/x?y=1&z=2#top" },
    ]);
  });

  it("leaves the sentence's punctuation out of the address", () => {
    expect(findLinks("See https://example.com/page.")).toEqual([
      { text: "See " },
      { text: "https://example.com/page", href: "https://example.com/page" },
      { text: "." },
    ]);
    expect(findLinks("(https://example.com/a), then")).toEqual([
      { text: "(" },
      { text: "https://example.com/a", href: "https://example.com/a" },
      { text: "), then" },
    ]);
  });

  it("keeps a bracket the address opened", () => {
    expect(findLinks("https://en.wikipedia.org/wiki/Mercury_(planet)")[0]).toEqual({
      text: "https://en.wikipedia.org/wiki/Mercury_(planet)",
      href: "https://en.wikipedia.org/wiki/Mercury_(planet)",
    });
  });

  it("links nothing but http(s)", () => {
    for (const text of ["javascript:alert(1)", "mailto:ana@example.com", "example.com", "ftp://example.com/file", "https://"]) {
      expect(findLinks(text), text).toEqual([{ text }]);
    }
  });

  it("gives back the text unchanged when put together again", () => {
    const text = "Room 4\nhttps://example.com/a.\n\nBring (https://example.com/b)!";
    expect(
      findLinks(text)
        .map((part) => part.text)
        .join(""),
    ).toBe(text);
  });
});

describe("linkify", () => {
  it("opens links in a new tab with no opener or referrer", () => {
    expect(html("Notes: https://example.com/doc")).toBe(
      'Notes: <a href="https://example.com/doc" target="_blank" rel="noopener noreferrer">https://example.com/doc</a>',
    );
  });

  it("never turns the text into markup", () => {
    expect(html('<img src=x onerror="alert(1)"> https://example.com/<b>')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; <a href="https://example.com/" target="_blank" rel="noopener noreferrer">https://example.com/</a>&lt;b&gt;',
    );
  });

  it("is the plain text when there is no link", () => {
    expect(linkify("Bring shoes")).toEqual(["Bring shoes"]);
    expect(linkify("")).toEqual([]);
  });
});
