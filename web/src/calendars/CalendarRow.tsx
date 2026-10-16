import { CALENDAR_NAME_MAX, calendarCreateSchema, type Calendar, type CalendarColor } from "@almanac/shared";
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { AlertIcon } from "../components/Field";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { CheckIcon } from "../components/icons";
import { Menu, type MenuSection } from "../components/Menu";
import { Popover } from "../components/Popover";
import { calendarColor } from "../data/calendars";
import { ColorPicker, colorName } from "./ColorPicker";
import "./calendars.css";

/** Why the last calendar stays: also the toast when the server refuses the delete (409). */
export const LAST_CALENDAR_REASON = "You can't delete your only calendar. Almanac needs at least one.";

/**
 * A calendar's name as the user typed it, checked against the API's own rule
 * (`calendarCreateSchema`: trimmed, 1 to 60 characters), so the form and the
 * server never disagree. `name` is the trimmed text to send.
 */
export function checkCalendarName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const parsed = calendarCreateSchema.shape.name.safeParse(raw);
  if (parsed.success) return { ok: true, name: parsed.data };
  return {
    ok: false,
    error: raw.trim() === "" ? "Give the calendar a name." : `Use ${CALENDAR_NAME_MAX} characters or fewer.`,
  };
}

export interface RowMenuActions {
  rename: () => void;
  chooseColor: () => void;
  remove: () => void;
}

/**
 * The ⋮ menu's content: Rename, Colour… (names the current colour; opens the
 * palette), and Delete, which is disabled for the user's only calendar. Pure,
 * so a test can read it without opening a menu.
 */
export function rowMenuSections(calendar: Calendar, isOnly: boolean, actions: RowMenuActions): MenuSection[] {
  return [
    {
      items: [
        { label: "Rename", onSelect: actions.rename },
        { label: "Colour…", detail: colorName(calendar.color), onSelect: actions.chooseColor },
      ],
    },
    {
      items: [{ label: "Delete", detail: isOnly ? "Only calendar" : undefined, disabled: isOnly, onSelect: actions.remove }],
    },
  ];
}

/** Three dots, stacked: Google's "options" mark (the shared icons have none). */
function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="12" cy="5.5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="18.5" r="2" />
    </svg>
  );
}

// --- Renaming in place -------------------------------------------------------------------

export interface RenameFieldProps {
  name: string;
  /** A new, valid name (trimmed). `viaKeyboard`: Enter, not a click elsewhere. */
  onCommit: (name: string, viaKeyboard: boolean) => void;
  onCancel: (viaKeyboard: boolean) => void;
}

/**
 * The name, editable where it stands. Enter saves, Esc cancels, and leaving
 * the field saves a changed, valid name (an empty one is dropped, so the old
 * name stays). Enter on an empty name says so and stays.
 */
export function RenameField({ name, onCommit, onCancel }: RenameFieldProps) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const finished = useRef(false);
  const errorId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (viaKeyboard: boolean) => {
    if (finished.current) return;
    const checked = checkCalendarName(value);
    if (!checked.ok) {
      if (viaKeyboard) return setError(checked.error);
      finished.current = true;
      return onCancel(false);
    }
    finished.current = true;
    if (checked.name === name) onCancel(viaKeyboard);
    else onCommit(checked.name, viaKeyboard);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      // Ours: not the drawer's or a dialog's behind it.
      event.preventDefault();
      event.stopPropagation();
      finished.current = true;
      onCancel(true);
    }
  };

  return (
    <div className="calendar-row__edit">
      <input
        ref={inputRef}
        type="text"
        className="calendar-row__rename"
        value={value}
        maxLength={CALENDAR_NAME_MAX}
        aria-label="Calendar name"
        aria-invalid={error !== undefined || undefined}
        aria-describedby={error === undefined ? undefined : errorId}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          setValue(event.target.value);
          setError(undefined);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => finish(false)}
      />
      {error !== undefined && (
        <p id={errorId} className="calendar-row__error" role="alert">
          <AlertIcon size={16} />
          {error}
        </p>
      )}
    </div>
  );
}

// --- Deleting ------------------------------------------------------------------------------

export interface DeleteCalendarDialogProps {
  calendar: Pick<Calendar, "name">;
  /** The user's only calendar: Delete stays disabled and says why. */
  isOnly: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Google's confirm: the calendar's events go with it. */
export function DeleteCalendarDialog({ calendar, isOnly, busy = false, onConfirm, onClose }: DeleteCalendarDialogProps) {
  return (
    <Dialog
      open
      onClose={onClose}
      title="Delete calendar"
      size="small"
      dismissOnBackdrop={false}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={isOnly || busy}
            title={isOnly ? LAST_CALENDAR_REASON : undefined}
          >
            Delete
          </Button>
        </>
      }
    >
      <p className="calendar-dialog__text">{`Delete "${calendar.name}"? Its events will be deleted too.`}</p>
      {isOnly && <p className="calendar-dialog__text calendar-dialog__text--note">{LAST_CALENDAR_REASON}</p>}
    </Dialog>
  );
}

// --- The row ---------------------------------------------------------------------------------

export interface CalendarRowProps {
  calendar: Calendar;
  /** The user's only calendar: it can't be deleted. */
  isOnly: boolean;
  onVisibleChange: (visible: boolean) => void;
  onRename: (name: string) => void;
  onRecolor: (color: CalendarColor) => void;
  /** Resolves when the delete is over, done or refused; the caller says what went wrong. */
  onDelete: () => Promise<void>;
}

/**
 * One calendar in the left column: a checkbox drawn in its colour (checked =
 * shown), its name, and, on hover or focus, the ⋮ menu: Rename (in place),
 * Colour… (the palette, the current colour ticked) and Delete (after a
 * confirm).
 */
export function CalendarRow({ calendar, isOnly, onVisibleChange, onRename, onRecolor, onDelete }: CalendarRowProps) {
  // The row itself, as state: the colour palette hangs from it.
  const [rowElement, setRowElement] = useState<HTMLLIElement | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [choosingColor, setChoosingColor] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  // After Enter or Esc in the name field, focus goes back to the row's checkbox, not to the page.
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (renaming || !restoreFocus.current) return;
    restoreFocus.current = false;
    rowElement?.querySelector<HTMLElement>(".calendar-row__input")?.focus();
  }, [renaming, rowElement]);

  const stopRenaming = (viaKeyboard: boolean) => {
    restoreFocus.current = viaKeyboard;
    setRenaming(false);
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
      setDeleting(false);
    }
  };

  const sections = rowMenuSections(calendar, isOnly, {
    rename: () => setRenaming(true),
    chooseColor: () => setChoosingColor(true),
    remove: () => setDeleting(true),
  });

  return (
    <li
      ref={setRowElement}
      className="calendar-row"
      style={{ "--calendar-color": calendarColor(calendar) } as CSSProperties}
      data-renaming={renaming || undefined}
    >
      <label className="calendar-row__toggle">
        <input
          type="checkbox"
          className="calendar-row__input"
          checked={calendar.visible}
          onChange={(event) => onVisibleChange(event.currentTarget.checked)}
        />
        <span className="calendar-row__box" aria-hidden="true">
          <CheckIcon size={12} strokeWidth={3.5} />
        </span>
        <span className={renaming ? "visually-hidden" : "calendar-row__name"} title={renaming ? undefined : calendar.name}>
          {calendar.name}
        </span>
      </label>
      {renaming ? (
        <RenameField
          name={calendar.name}
          onCommit={(name, viaKeyboard) => {
            stopRenaming(viaKeyboard);
            onRename(name);
          }}
          onCancel={stopRenaming}
        />
      ) : (
        <Menu
          label={`Options for ${calendar.name}`}
          triggerLabel={`Options for ${calendar.name}`}
          triggerClassName="icon-button icon-button--small calendar-row__more"
          align="end"
          trigger={<MoreIcon />}
          sections={sections}
        />
      )}
      {choosingColor && rowElement && (
        <Popover anchor={rowElement} onClose={() => setChoosingColor(false)} label={`Colour of ${calendar.name}`} className="calendar-colors">
          <ColorPicker
            value={calendar.color}
            autoFocus
            onChange={(color) => {
              setChoosingColor(false);
              if (color !== calendar.color) onRecolor(color);
            }}
          />
        </Popover>
      )}
      {deleting && (
        <DeleteCalendarDialog
          calendar={calendar}
          isOnly={isOnly}
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onClose={() => {
            if (!busy) setDeleting(false);
          }}
        />
      )}
    </li>
  );
}
