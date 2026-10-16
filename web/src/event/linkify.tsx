import type { ReactNode } from "react";

/**
 * Links in an event's location and notes made clickable, as Google does:
 * every `http://` or `https://` address becomes a link that opens in a new
 * tab (`rel="noopener noreferrer"`). Nothing else is a link: no `javascript:`,
 * no `mailto:`, no bare `example.com`. The text stays text (React escapes it),
 * so nothing typed into an event can inject HTML.
 */

/** One run of the text: plain, or a link with the address it opens. */
export type TextPart = { text: string; href?: undefined } | { text: string; href: string };

// From the scheme to the first space or character that can't be part of an address in running text.
const ADDRESS = /\bhttps?:\/\/[^\s<>"'`]+/gi;
// Punctuation that ends the sentence rather than the address: "see https://example.com."
const SENTENCE_END = ".,;:!?";
const OPENER_OF: Readonly<Record<string, string>> = { ")": "(", "]": "[", "}": "{" };

/**
 * The address without the sentence's punctuation on its end. A closing
 * bracket goes too, unless the address opened it:
 * "(https://example.com)" loses the `)`, https://en.wikipedia.org/wiki/Foo_(bar) keeps it.
 */
function trimAddress(candidate: string): string {
  let address = candidate;
  while (address.length > 0) {
    const last = address.slice(-1);
    const opener = OPENER_OF[last];
    if (opener !== undefined) {
      if (count(address, opener) >= count(address, last)) break;
    } else if (!SENTENCE_END.includes(last)) break;
    address = address.slice(0, -1);
  }
  return address;
}

function count(text: string, char: string): number {
  let found = 0;
  for (const each of text) if (each === char) found += 1;
  return found;
}

/** A real http(s) URL, as the browser will open it, or `null`. */
function safeHref(address: string): string | null {
  try {
    const url = new URL(address);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** `text` cut into plain runs and links, in order; joined back together they are `text` again. */
export function findLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let plainFrom = 0;
  for (const match of text.matchAll(ADDRESS)) {
    const start = match.index;
    const address = trimAddress(match[0]);
    const href = safeHref(address);
    if (href === null) continue;
    if (start > plainFrom) parts.push({ text: text.slice(plainFrom, start) });
    parts.push({ text: address, href });
    plainFrom = start + address.length;
  }
  if (plainFrom < text.length) parts.push({ text: text.slice(plainFrom) });
  return parts;
}

/** The text with its links as `<a>` elements; line breaks are kept by the caller's `white-space: pre-wrap`. */
export function linkify(text: string): ReactNode[] {
  return findLinks(text).map((part, index) =>
    part.href === undefined ? (
      part.text
    ) : (
      <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">
        {part.text}
      </a>
    ),
  );
}
