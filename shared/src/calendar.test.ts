import { describe, expect, it } from "vitest";
import {
  CALENDAR_COLORS,
  CALENDAR_COLOR_KEYS,
  calendarCreateSchema,
  calendarPatchSchema,
  nextCalendarColor,
} from "./calendar.js";
import { searchQuerySchema } from "./search.js";
import { settingsPatchSchema } from "./settings.js";

describe("CALENDAR_COLORS", () => {
  it("has the ten keys in picker order, each a hex colour", () => {
    expect(CALENDAR_COLOR_KEYS).toEqual([
      "blue",
      "teal",
      "green",
      "olive",
      "yellow",
      "orange",
      "red",
      "pink",
      "purple",
      "graphite",
    ]);
    for (const hex of Object.values(CALENDAR_COLORS)) expect(hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("picks the first colour not in use, and blue when all are", () => {
    expect(nextCalendarColor([])).toBe("blue");
    expect(nextCalendarColor(["blue", "green"])).toBe("teal");
    expect(nextCalendarColor(CALENDAR_COLOR_KEYS)).toBe("blue");
  });
});

describe("calendar schemas", () => {
  it("trims the name and keeps it to 1-60 characters", () => {
    expect(calendarCreateSchema.parse({ name: "  Work  " })).toEqual({ name: "Work" });
    expect(calendarCreateSchema.safeParse({ name: " " }).success).toBe(false);
    expect(calendarCreateSchema.safeParse({ name: "x".repeat(61) }).success).toBe(false);
    expect(calendarCreateSchema.safeParse({}).success).toBe(false);
  });

  it("takes only palette keys and known fields", () => {
    expect(calendarPatchSchema.safeParse({ color: "teal" }).success).toBe(true);
    expect(calendarPatchSchema.safeParse({ color: "#4285F4" }).success).toBe(false);
    expect(calendarPatchSchema.safeParse({ position: 3 }).success).toBe(false);
  });
});

describe("settingsPatchSchema", () => {
  it("takes an IANA zone and refuses anything else", () => {
    expect(settingsPatchSchema.parse({ timeZone: "America/New_York" })).toEqual({ timeZone: "America/New_York" });
    expect(settingsPatchSchema.safeParse({ timeZone: "+02:00" }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ timeZone: "Nowhere/Special" }).success).toBe(false);
  });
});

describe("searchQuerySchema", () => {
  it("takes 1-100 characters once trimmed", () => {
    expect(searchQuerySchema.parse({ q: "  sedinta " })).toEqual({ q: "sedinta" });
    expect(searchQuerySchema.safeParse({ q: "  " }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
    expect(searchQuerySchema.safeParse({}).success).toBe(false);
  });
});
