import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ZoneList } from "./TimeZoneDialog";
import { cityOf, formatOffset, listTimeZones, matchesZone, normalize, offsetMinutesAt, supportedZones, zoneEntry, zoneLabel } from "./time-zones";

const WINTER = Date.UTC(2026, 0, 15, 12); // 15 January 2026
const SUMMER = Date.UTC(2026, 6, 15, 12); // 15 July 2026

describe("formatOffset", () => {
  it("writes the sign, two-digit hours and minutes", () => {
    expect(formatOffset(0)).toBe("+00:00");
    expect(formatOffset(180)).toBe("+03:00");
    expect(formatOffset(-300)).toBe("-05:00");
    expect(formatOffset(330)).toBe("+05:30");
    expect(formatOffset(-570)).toBe("-09:30");
    expect(formatOffset(765)).toBe("+12:45");
  });
});

describe("offsets and labels", () => {
  it("follow daylight saving: Bucharest is +02:00 in winter and +03:00 in summer", () => {
    expect(zoneLabel("Europe/Bucharest", WINTER)).toBe("(GMT+02:00) Bucharest");
    expect(zoneLabel("Europe/Bucharest", SUMMER)).toBe("(GMT+03:00) Bucharest");
  });

  it("reads London and New York in both seasons", () => {
    expect(zoneLabel("Europe/London", WINTER)).toBe("(GMT+00:00) London");
    expect(zoneLabel("Europe/London", SUMMER)).toBe("(GMT+01:00) London");
    expect(zoneLabel("America/New_York", WINTER)).toBe("(GMT-05:00) New York");
    expect(zoneLabel("America/New_York", SUMMER)).toBe("(GMT-04:00) New York");
  });

  it("keeps half-hour and quarter-hour zones, and the southern summer", () => {
    expect(offsetMinutesAt("Asia/Kolkata", WINTER)).toBe(330);
    expect(offsetMinutesAt("Asia/Kolkata", SUMMER)).toBe(330);
    expect(offsetMinutesAt("Asia/Kathmandu", WINTER)).toBe(345);
    expect(offsetMinutesAt("Australia/Sydney", WINTER)).toBe(660); // January is summer there
    expect(offsetMinutesAt("Australia/Sydney", SUMMER)).toBe(600);
    expect(offsetMinutesAt("Australia/Lord_Howe", WINTER)).toBe(660);
    expect(offsetMinutesAt("Australia/Lord_Howe", SUMMER)).toBe(630);
  });

  it("gives UTC +00:00 and accepts a Date as well as epoch ms", () => {
    expect(zoneLabel("UTC", WINTER)).toBe("(GMT+00:00) UTC");
    expect(offsetMinutesAt("Europe/Bucharest", new Date(SUMMER))).toBe(180);
  });

  it("names the city without the region and with spaces", () => {
    expect(cityOf("Europe/Bucharest")).toBe("Bucharest");
    expect(cityOf("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
    expect(cityOf("UTC")).toBe("UTC");
  });

  it("makes an entry with the name as listed", () => {
    expect(zoneEntry("Europe/Bucharest", SUMMER)).toMatchObject({
      zone: "Europe/Bucharest",
      city: "Bucharest",
      offsetMinutes: 180,
      offset: "+03:00",
      label: "(GMT+03:00) Bucharest",
    });
  });
});

describe("listTimeZones", () => {
  const list = listTimeZones(SUMMER);

  it("adds UTC, which Intl leaves out, and keeps every other name as listed", () => {
    const zones = list.map((entry) => entry.zone);
    expect(zones).toContain("UTC");
    expect(zones).toContain("Europe/Bucharest");
    const listed = new Set([...Intl.supportedValuesOf("timeZone"), "UTC"]);
    for (const zone of zones) expect(listed.has(zone), zone).toBe(true);
    expect(new Set(zones).size).toBe(zones.length);
    expect(supportedZones()).toContain("UTC");
  });

  it("runs from the west to the east, then by city", () => {
    for (let index = 1; index < list.length; index++) {
      const before = list[index - 1];
      const entry = list[index];
      expect(before && entry && before.offsetMinutes <= entry.offsetMinutes, `${before?.zone} before ${entry?.zone}`).toBe(true);
    }
    const plusThree = list.filter((entry) => entry.offsetMinutes === 180).map((entry) => entry.city);
    expect(plusThree).toEqual([...plusThree].sort((a, b) => a.localeCompare(b, "en")));
  });
});

describe("normalize", () => {
  it("lower-cases, drops accents and turns underscores into spaces", () => {
    expect(normalize("  São_Paulo ")).toBe("sao paulo");
    expect(normalize("Bucureşti")).toBe("bucuresti");
    expect(normalize("Zürich")).toBe("zurich");
  });
});

describe("matchesZone", () => {
  // Zones named outright, not taken from the runtime's list: Node lists "Asia/Calcutta" where a browser lists "Asia/Kolkata".
  const ZONES = [
    "Europe/Bucharest",
    "Europe/London",
    "Europe/Paris",
    "America/New_York",
    "America/Sao_Paulo",
    "America/Argentina/Buenos_Aires",
    "Asia/Kolkata",
    "Asia/Karachi",
    "Asia/Dhaka",
    "Asia/Tokyo",
    "UTC",
  ];
  const winter = ZONES.map((zone) => zoneEntry(zone, WINTER));
  const summer = ZONES.map((zone) => zoneEntry(zone, SUMMER));
  const found = (query: string, list = summer) => list.filter((entry) => matchesZone(entry, query)).map((entry) => entry.zone);

  it("finds a city, ignoring case and spaces at the ends", () => {
    expect(found("bucharest")).toContain("Europe/Bucharest");
    expect(found("BUCHAREST")).toContain("Europe/Bucharest");
    expect(found("  Bucharest  ")).toContain("Europe/Bucharest");
    expect(found("bucharest")).not.toContain("Europe/London");
  });

  it("finds a region by its name", () => {
    const europe = found("europe");
    expect(europe).toContain("Europe/Bucharest");
    expect(europe).toContain("Europe/London");
    expect(europe).toEqual(["Europe/Bucharest", "Europe/London", "Europe/Paris"]);
  });

  it("ignores accents typed in the search, and underscores or spaces in a name", () => {
    expect(found("são paulo")).toContain("America/Sao_Paulo");
    expect(found("sao paulo")).toContain("America/Sao_Paulo");
    expect(found("buenos_aires")).toContain("America/Argentina/Buenos_Aires");
    expect(found("buenos aires")).toContain("America/Argentina/Buenos_Aires");
    expect(found("argentina buenos")).toContain("America/Argentina/Buenos_Aires");
  });

  it("finds an offset as it is shown, in the season asked about", () => {
    expect(found("+03:00", summer)).toContain("Europe/Bucharest");
    expect(found("+03:00", summer)).not.toContain("Europe/London");
    expect(found("+03:00", winter)).not.toContain("Europe/Bucharest");
    expect(found("+02:00", winter)).toContain("Europe/Bucharest");
    expect(found("+01:00", summer)).toContain("Europe/London");
  });

  it("reads looser offsets: gmt+3, utc-5, +5:30", () => {
    expect(found("gmt+3", summer)).toContain("Europe/Bucharest");
    expect(found("GMT+2", winter)).toContain("Europe/Bucharest");
    expect(found("utc-5", winter)).toContain("America/New_York");
    expect(found("utc-5", summer)).not.toContain("America/New_York");
    expect(found("+5:30")).toContain("Asia/Kolkata");
    expect(found("+5:30")).not.toContain("Asia/Karachi");
  });

  it("takes an hour alone as every offset in that hour", () => {
    expect(found("+5")).toContain("Asia/Kolkata");
    expect(found("+5")).toContain("Asia/Karachi");
    expect(found("+5")).not.toContain("Asia/Dhaka");
    expect(found("-0")).toContain("UTC");
  });

  it("wants every word to match", () => {
    expect(found("europe +3", summer)).toContain("Europe/Bucharest");
    expect(found("europe +3", summer)).not.toContain("Europe/London");
    expect(found("bucharest london")).toEqual([]);
  });

  it("matches everything for an empty search and nothing for nonsense", () => {
    expect(found("")).toHaveLength(ZONES.length);
    expect(found("   ")).toHaveLength(ZONES.length);
    expect(found("zzzzzz")).toEqual([]);
  });
});

describe("ZoneList", () => {
  const entries = listTimeZones(WINTER).filter((entry) => ["Europe/Bucharest", "Europe/London", "UTC"].includes(entry.zone));
  const render = (selected: string, shown = entries) => renderToStaticMarkup(createElement(ZoneList, { entries: shown, selected, onSelect: () => undefined }));

  it("shows each zone as its label over its name, the chosen one ticked and in the Tab order", () => {
    const html = render("Europe/Bucharest");
    expect(html).toContain("(GMT+02:00) Bucharest");
    expect(html).toContain("Europe/Bucharest");
    expect(html).toContain("(GMT+00:00) London");
    const tags = [...html.matchAll(/<button[^>]*role="radio"[^>]*>/g)].map((match) => match[0]);
    expect(tags).toHaveLength(3);
    const chosen = tags.filter((tag) => tag.includes('aria-checked="true"'));
    expect(chosen).toHaveLength(1);
    expect(chosen[0]).toContain('data-zone="Europe/Bucharest"');
    expect(chosen[0]).toContain('tabindex="0"');
    expect(tags.filter((tag) => tag.includes('tabindex="0"'))).toHaveLength(1);
  });

  it("puts the first row in the Tab order when the chosen zone is not shown", () => {
    const html = render("Asia/Tokyo");
    expect(html).not.toContain('aria-checked="true"');
    const first = [...html.matchAll(/<button[^>]*role="radio"[^>]*>/g)][0]?.[0] ?? "";
    expect(first).toContain('tabindex="0"');
  });

  it("says so when the search leaves nothing", () => {
    expect(render("UTC", [])).toContain("No time zone matches that.");
  });
});
