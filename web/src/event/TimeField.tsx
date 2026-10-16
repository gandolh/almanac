import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { parseTimeText, type TimeOption } from "./editor-state";
import { placeTimeList, roomAround } from "./time-list";
import "./editor.css";

/**
 * A time of day, 24-hour always: type "14:30" or "1430", or pick from a
 * list in 15-minute steps (a combobox on a listbox, not a `<datalist>`,
 * whose look and keys depend on the browser).
 *
 * - The text is committed on Enter, Tab or leaving the field; text that is
 *   no time goes back to the last good one.
 * - ↑ ↓ move through the list, Enter picks, Esc closes the list (and only
 *   the list: the dialog behind stays open).
 * - Picking from the list never takes focus out of the field.
 * - The list stays where it can be seen (time-list.ts): lined up with the
 *   field's right edge when the left one would run it off the screen, and
 *   cut short, or opened upwards, in a short window.
 */
export interface TimeFieldProps {
  /** "14:30" */
  value: string;
  /** The list's rows; asked for only while the list is open. */
  options: () => readonly TimeOption[];
  onChange: (value: string) => void;
  /** The field's accessible name: "Start time". */
  label: string;
  invalid?: boolean;
  /** The id of the text that explains `invalid`. */
  describedBy?: string;
}

const NO_OPTIONS: readonly TimeOption[] = [];

export function TimeField({ value, options: getOptions, onChange, label, invalid, describedBy }: TimeFieldProps) {
  // What is typed, until it is committed; `null` shows `value`.
  const [typed, setTyped] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const fieldRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const options = open ? getOptions() : NO_OPTIONS;
  const selected = options.findIndex((option) => option.value === value);
  const listShown = open && options.length > 0;

  // Placed before it is first painted, and again when the window (or the room the keyboard leaves) changes.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    const list = listRef.current;
    if (!listShown || !field || !list) return;
    const place = () => {
      list.style.maxHeight = "";
      const { align, side, maxHeight } = placeTimeList(
        field.getBoundingClientRect(),
        { width: list.offsetWidth, height: list.offsetHeight },
        roomAround(field),
      );
      list.dataset.align = align;
      list.dataset.side = side;
      if (maxHeight !== null) list.style.maxHeight = `${maxHeight}px`;
    };
    place();
    const viewport = window.visualViewport;
    window.addEventListener("resize", place);
    viewport?.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      viewport?.removeEventListener("resize", place);
    };
  }, [listShown]);

  // On opening, the chosen time is in the middle of the list; moving by key keeps the active one in view.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    const row = list.querySelector<HTMLElement>(active >= 0 ? '[data-active="true"]' : '[aria-selected="true"]');
    if (!row) return;
    if (active < 0) {
      list.scrollTop = row.offsetTop - (list.clientHeight - row.offsetHeight) / 2;
    } else if (row.offsetTop < list.scrollTop) {
      list.scrollTop = row.offsetTop;
    } else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
    }
  }, [open, active]);

  const commit = (text: string) => {
    const time = parseTimeText(text);
    if (time !== null && time !== value) onChange(time);
    setTyped(null);
  };

  const pick = (option: TimeOption) => {
    onChange(option.value);
    setTyped(null);
    setOpen(false);
    setActive(-1);
  };

  const move = (by: number) => {
    if (!open) {
      setOpen(true);
      return;
    }
    if (options.length === 0) return;
    const from = active >= 0 ? active : selected;
    const next = from < 0 ? (by > 0 ? 0 : options.length - 1) : Math.min(options.length - 1, Math.max(0, from + by));
    setTyped(null);
    setOpen(true);
    setActive(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Enter": {
        // Never submits the form: the time is only being settled.
        event.preventDefault();
        const option = options[active];
        if (typed === null && open && option) pick(option);
        else commit(typed ?? value);
        setOpen(false);
        setActive(-1);
        break;
      }
      case "Escape":
        if (open || typed !== null) {
          event.preventDefault();
          setTyped(null);
          setOpen(false);
          setActive(-1);
        }
        break;
    }
  };

  const activeId = open && active >= 0 ? `${listId}-${active}` : undefined;
  return (
    <div ref={fieldRef} className="time-field">
      <input
        type="text"
        role="combobox"
        className="editor-input time-field__input"
        value={typed ?? value}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-autocomplete="none"
        aria-activedescendant={activeId}
        autoComplete="off"
        spellCheck={false}
        maxLength={8}
        onFocus={(event) => {
          event.currentTarget.select();
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setTyped(event.target.value);
          setActive(-1);
        }}
        onBlur={() => {
          if (typed !== null) commit(typed);
          setOpen(false);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
      />
      {listShown && (
        // A press in the list (its scrollbar too) never takes focus from the field; a click on a row picks.
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          className="time-field__list"
          onMouseDown={(event) => event.preventDefault()}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === selected}
              data-active={index === active || undefined}
              className="time-field__option"
              onClick={() => pick(option)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
