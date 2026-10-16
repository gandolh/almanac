import { SEARCH_QUERY_MAX } from "@almanac/shared";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from "react";
import { BackIcon, CloseIcon, SearchIcon } from "../components/icons";
import { useIsDesktop } from "../components/viewport";
import { registerCommand } from "../layout/commands";
import { goBack, lastViewRoute, navigateToSearch, usePathname, useQueryParam, useRoute } from "../router";
import { normalizeQuery } from "./search-api";
import "./search.css";

/**
 * The top bar's search: a magnifier that opens into a field (on a phone the
 * field covers the whole bar). Enter shows the results at `/search?q=…`;
 * Esc or the back arrow closes the field and returns to the last calendar
 * view. The `/` key opens it (the "focusSearch" command). On the results'
 * address the field is open and holds the query, so a link to a search
 * arrives filled in.
 */
export function SearchBox() {
  const route = useRoute();
  const pathname = usePathname();
  const query = useQueryParam("q");
  const desktop = useIsDesktop();
  const onResults = route.name === "search";

  // Opened by hand from this address; going anywhere else closes it again.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = onResults || openedAt === pathname;

  // The field holds the address's query while on the results, and starts empty elsewhere.
  const shown = onResults ? query : null;
  const [synced, setSynced] = useState(shown);
  const [value, setValue] = useState(shown ?? "");
  if (synced !== shown) {
    setSynced(shown);
    setValue(shown ?? "");
  }

  const field = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  // Set when a click or the key opens the field, so focus moves there (a cold load of `/search?q=` leaves it alone).
  const wantFocus = useRef(false);
  // Set when the field closes, so focus returns to the magnifier.
  const wantOpenerFocus = useRef(false);

  useEffect(() => {
    if (open && wantFocus.current) {
      wantFocus.current = false;
      field.current?.focus();
      field.current?.select();
    } else if (!open && wantOpenerFocus.current) {
      wantOpenerFocus.current = false;
      opener.current?.focus();
    }
  }, [open]);

  useEffect(
    () =>
      registerCommand("focusSearch", () => {
        const input = field.current;
        if (input) {
          input.focus();
          input.select();
        } else {
          wantFocus.current = true;
          setOpenedAt(pathname);
        }
      }),
    [pathname],
  );

  const close = () => {
    wantOpenerFocus.current = true;
    setOpenedAt(null);
    setValue("");
    if (onResults) goBack(lastViewRoute());
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = normalizeQuery(value);
    if (text === "") {
      field.current?.focus();
      return;
    }
    // The results hold the field open from here on. Searching again from the results swaps their entry, so Back still leaves for the view.
    setOpenedAt(null);
    navigateToSearch(text, { replace: onResults });
    if (!desktop) field.current?.blur();
  };

  if (!open) {
    return (
      <button
        ref={opener}
        type="button"
        className="icon-button"
        aria-label="Search"
        title="Search (/)"
        aria-keyshortcuts="/"
        onClick={() => {
          wantFocus.current = true;
          setOpenedAt(pathname);
        }}
      >
        <SearchIcon />
      </button>
    );
  }
  return (
    <SearchField
      inputRef={field}
      value={value}
      onChange={setValue}
      onSubmit={submit}
      onClose={close}
      onClear={() => {
        setValue("");
        field.current?.focus();
      }}
    />
  );
}

export interface SearchFieldProps {
  inputRef?: Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  /** The back arrow, and Esc. */
  onClose: () => void;
  /** The ✕, shown once something is typed. */
  onClear: () => void;
}

/** The open field (for tests): back arrow, the input, and ✕ to clear. */
export function SearchField({ inputRef, value, onChange, onSubmit, onClose, onClear }: SearchFieldProps) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onClose();
  };
  return (
    <form className="search" role="search" onSubmit={onSubmit} onKeyDown={onKeyDown}>
      <button type="button" className="icon-button" aria-label="Close search" onClick={onClose}>
        <BackIcon />
      </button>
      <input
        ref={inputRef}
        type="search"
        className="search__input"
        name="q"
        value={value}
        maxLength={SEARCH_QUERY_MAX}
        placeholder="Search"
        aria-label="Search events"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
      {value !== "" && (
        <button type="button" className="icon-button" aria-label="Clear search" onClick={onClear}>
          <CloseIcon />
        </button>
      )}
    </form>
  );
}
