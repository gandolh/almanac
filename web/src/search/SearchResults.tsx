// STUB: brief 10 replaces this file with the search results (same props).
import "../styles/stubs.css";

export interface SearchResultsProps {
  /** `?q=` from the address, as typed; may be empty. */
  query: string;
}

/** Until brief 10: what was asked for, and no results. */
export function SearchResults({ query }: SearchResultsProps) {
  return (
    <section className="stub-area" aria-label="Search results">
      <p className="stub-area__text">{query.trim() === "" ? "Search for an event." : `Search for "${query.trim()}".`}</p>
    </section>
  );
}
