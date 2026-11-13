/**
 * The text layer of an iCalendar file (RFC 5545 section 3): escaping a TEXT
 * value, folding a content line at 75 octets, and joining lines with CRLF.
 * Pure: the components are `calendar.ts`'s.
 */

/** The longest a content line may be, in octets, before its line break (RFC 5545 3.1). */
export const MAX_LINE_OCTETS = 75;

/**
 * A control character a TEXT value can't hold (RFC 5545 3.1, `CONTROL`):
 * everything below U+0020 but the tab, and DEL. Line breaks are escaped
 * before these are dropped.
 */
function isControl(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code < 0x20 && code !== 0x09) || code === 0x7f;
}

/**
 * A TEXT value (RFC 5545 3.3.11): a backslash, a semicolon and a comma
 * escaped, every line break (CRLF, CR or LF) as `\n`, and any other control
 * character dropped. What the user typed can then never end a line or start
 * a property of its own.
 */
export function escapeText(value: string): string {
  const escaped = value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
  return Array.from(escaped)
    .filter((char) => !isControl(char))
    .join("");
}

/**
 * One content line folded (RFC 5545 3.1): a CRLF and a space before the
 * octet that would make a line longer than 75, never inside a character's
 * UTF-8 bytes. The space starts the next line and counts towards its 75.
 */
export function foldLine(line: string): string {
  let folded = "";
  let width = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    if (width + size > MAX_LINE_OCTETS) {
      folded += "\r\n ";
      width = 1;
    }
    folded += char;
    width += size;
  }
  return folded;
}

/** Unfolded content lines as the file: each folded, each ended by CRLF. */
export function joinLines(lines: readonly string[]): string {
  return lines.map((line) => `${foldLine(line)}\r\n`).join("");
}
