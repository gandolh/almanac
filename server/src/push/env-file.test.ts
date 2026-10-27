import { describe, expect, it } from "vitest";
import { envValue, withVapidLines } from "./env-file.js";

// Stand-ins, not keys.
const LINES = { VAPID_PUBLIC_KEY: "public-stand-in", VAPID_PRIVATE_KEY: "private-stand-in", VAPID_SUBJECT: "mailto:johndoe@example.com" };

describe("envValue", () => {
  it("reads a key, the last one winning, quotes and spaces dropped", () => {
    expect(envValue("A=1\nB= two \nA=3", "A")).toBe("3");
    expect(envValue("B= two ", "B")).toBe("two");
    expect(envValue('C="quoted"', "C")).toBe("quoted");
    expect(envValue("A=1", "B")).toBeUndefined();
    expect(envValue("# VAPID_PUBLIC_KEY=x", "VAPID_PUBLIC_KEY")).toBeUndefined();
  });
});

describe("withVapidLines", () => {
  it("fills the empty lines copied from .env.example where they stand", () => {
    const text = "PORT=8809\nVAPID_PUBLIC_KEY=\nVAPID_PRIVATE_KEY=\nVAPID_SUBJECT=\nSEED_USERNAME=\n";
    expect(withVapidLines(text, LINES)).toBe(
      "PORT=8809\nVAPID_PUBLIC_KEY=public-stand-in\nVAPID_PRIVATE_KEY=private-stand-in\nVAPID_SUBJECT=mailto:johndoe@example.com\nSEED_USERNAME=\n",
    );
  });

  it("adds what is missing at the end, and keeps a subject already set", () => {
    expect(withVapidLines("PORT=8809\nVAPID_SUBJECT=mailto:owner@example.org", LINES)).toBe(
      "PORT=8809\nVAPID_SUBJECT=mailto:owner@example.org\nVAPID_PUBLIC_KEY=public-stand-in\nVAPID_PRIVATE_KEY=private-stand-in\n",
    );
  });

  it("writes a new file's three lines", () => {
    expect(withVapidLines("", LINES)).toBe(
      "VAPID_PUBLIC_KEY=public-stand-in\nVAPID_PRIVATE_KEY=private-stand-in\nVAPID_SUBJECT=mailto:johndoe@example.com\n",
    );
  });
});
