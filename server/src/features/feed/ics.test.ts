import { describe, expect, it } from "vitest";
import { MAX_LINE_OCTETS, escapeText, foldLine, joinLines } from "./ics.js";

/** RFC 5545 3.1: a line break followed by one space or tab is removed. */
const unfold = (text: string) => text.replace(/\r\n[ \t]/g, "");

/** The inverse of `escapeText` for what it writes. */
const unescape = (value: string) =>
  value.replace(/\\([\\;,nN])/g, (_, char: string) => (/n/i.test(char) ? "\n" : char));

describe("escapeText", () => {
  it("escapes a backslash, a semicolon and a comma", () => {
    expect(escapeText("a\\b;c,d")).toBe("a\\\\b\\;c\\,d");
    // The backslash first, so the ones added for ; and , aren't doubled.
    expect(escapeText("\\;")).toBe("\\\\\\;");
  });

  it("writes every line break, CRLF, CR or LF, as \\n", () => {
    expect(escapeText("one\r\ntwo\nthree\rfour")).toBe("one\\ntwo\\nthree\\nfour");
    expect(escapeText("end\r\n")).toBe("end\\n");
  });

  it("drops other control characters and keeps a tab and every other character", () => {
    expect(escapeText("a\u0000b\u0007c\u001bd\u007fe\tf")).toBe("abcde\tf");
    expect(escapeText("Ședință: 10:00 — ☕ 👋")).toBe("Ședință: 10:00 — ☕ 👋");
  });

  it("keeps a typed property on the same line as text", () => {
    const value = escapeText("Lunch\r\nEND:VEVENT\r\nBEGIN:VALARM\r\nTRIGGER:-PT5M");
    expect(value).not.toMatch(/[\r\n]/);
    expect(value).toBe("Lunch\\nEND:VEVENT\\nBEGIN:VALARM\\nTRIGGER:-PT5M");
  });

  it("is undone by unescaping", () => {
    const text = "Room 2, floor 3; bring \\ the slides\nand coffee";
    expect(unescape(escapeText(text))).toBe(text);
  });
});

describe("foldLine", () => {
  it("leaves a line of 75 octets alone and folds the 76th onto a line that starts with a space", () => {
    const exact = `SUMMARY:${"a".repeat(MAX_LINE_OCTETS - 8)}`;
    expect(foldLine(exact)).toBe(exact);
    const longer = `${exact}b`;
    expect(foldLine(longer)).toBe(`${exact}\r\n b`);
  });

  it("counts octets, and never splits a character's UTF-8 bytes", () => {
    // "ș" is two octets and "👋" four: a fold falls before them, not inside.
    for (const char of ["ș", "—", "👋"]) {
      for (let pad = 60; pad <= 76; pad++) {
        const line = `DESCRIPTION:${"x".repeat(pad - 12)}${char.repeat(30)}`;
        const parts = foldLine(line).split("\r\n");
        for (const [index, part] of parts.entries()) {
          expect(Buffer.byteLength(part, "utf8")).toBeLessThanOrEqual(MAX_LINE_OCTETS);
          if (index > 0) expect(part.startsWith(" ")).toBe(true);
          // A split character would decode to U+FFFD.
          expect(Buffer.from(part, "utf8").toString("utf8")).toBe(part);
          expect(part).not.toContain("�");
        }
        expect(unfold(foldLine(line))).toBe(line);
      }
    }
  });

  it("folds a long line as often as it takes, each continuation 74 octets past its space", () => {
    const line = `DESCRIPTION:${"y".repeat(500)}`;
    const parts = foldLine(line).split("\r\n");
    expect(parts[0]).toHaveLength(75);
    for (const part of parts.slice(1, -1)) expect(part).toHaveLength(75);
    expect(unfold(parts.join("\r\n"))).toBe(line);
  });
});

describe("joinLines", () => {
  it("ends every line, the last too, with CRLF", () => {
    expect(joinLines(["BEGIN:VCALENDAR", "END:VCALENDAR"])).toBe("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
  });
});
