/**
 * Text folded for search: lower case, decomposed (NFD), combining marks
 * removed. The stored `search_text` and the query are both folded this way,
 * so "sedinta" finds "Ședință" and "ȘEDINȚĂ" (and the old cedilla "Şedinţă").
 */
export function foldSearchText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

/** An event's `search_text`: its title, location and notes, folded, one per line. */
export function eventSearchText(event: { title: string; location: string; notes: string }): string {
  return foldSearchText([event.title, event.location, event.notes].join("\n"));
}
