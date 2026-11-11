import { SEARCH_QUERY_MAX } from "@almanac/shared";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from "react";
import { BackIcon, CloseIcon, SearchIcon } from "../components/icons";
import { useIsDesktop } from "../components/viewport";
import { registerCommand } from "../layout/commands";
import { goBack, lastViewRoute, navigateToSearch, usePathname, useQueryParam, useRoute } from "../router";
import { normalizeQuery } from "./search-api";
import { ICON_BUTTON } from "../components/looks";

/** The field lifts and whitens on focus, in the focus ring's place. On a phone it is the top bar: back arrow, the field, ✕. */
const FORM_CLASS = [
  "flex h-control-large w-search-field flex-none items-center gap-0.5 rounded-pill bg-field px-1",
  "transition-[background-color,box-shadow] duration-(--duration-fast) ease-out focus-within:bg-surface focus-within:shadow-raised",
  "max-[1200px]:w-search-field-narrow max-[900px]:w-search-field-narrowest",
  "max-md:absolute max-md:inset-0 max-md:z-[1] max-md:h-auto max-md:w-auto max-md:rounded-none max-md:bg-ground max-md:pr-gutter-phone max-md:pl-2 max-md:shadow-none max-md:focus-within:bg-ground max-md:focus-within:shadow-none",
].join(" ");

/** Without the browser's own ✕: ours clears and keeps the focus. 16 px on a phone, so iOS doesn't zoom in. */
const INPUT_CLASS =
  "h-full min-w-0 flex-1 appearance-none rounded-pill bg-transparent px-2 text-body text-ink focus-visible:outline-none max-md:text-input-phone [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:hidden [&::-webkit-search-decoration]:appearance-none";

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
        className={ICON_BUTTON}
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
    <form className={FORM_CLASS} role="search" onSubmit={onSubmit} onKeyDown={onKeyDown}>
      <button type="button" className={ICON_BUTTON} aria-label="Close search" onClick={onClose}>
        <BackIcon />
      </button>
      <input
        ref={inputRef}
        type="search"
        className={INPUT_CLASS}
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
        <button type="button" className={ICON_BUTTON} aria-label="Clear search" onClick={onClear}>
          <CloseIcon />
        </button>
      )}
    </form>
  );
}
