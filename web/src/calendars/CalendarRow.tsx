import { CALENDAR_NAME_MAX, calendarCreateSchema, type Calendar, type CalendarColor } from "@almanac/shared";
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { AlertIcon } from "../components/Field";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { CheckIcon } from "../components/icons";
import { Menu, type MenuSection } from "../components/ui/Menu";
import { Popover } from "../components/ui/Popover";
import { calendarColor, calendarInk } from "../data/calendars";
import { cn } from "../lib/cn";
import { ColorPicker, colorName } from "./ColorPicker";
import { ICON_BUTTON_SMALL } from "../components/looks";

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
      items: [
        { label: "Delete", detail: isOnly ? "Only calendar" : undefined, disabled: isOnly, onSelect: actions.remove },
      ],
    },
  ];
}

/** Three dots, stacked: the "options" mark (the shared icons have none). */
function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="12" cy="5.5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="18.5" r="2" />
    </svg>
  );
}

/** The ⋮ shows under the pointer, with the keyboard, and while its menu is open; a touch screen always has it. */
const MORE_CLASS =
  "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100";

/** A filled field where the name was. 16 px on a phone: iOS doesn't zoom into it. */
const RENAME_CLASS = [
  "h-[30px] w-full rounded-small bg-field px-2 text-meta text-ink max-md:h-9 max-md:text-input-phone",
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring",
  "aria-invalid:outline-[1.5px] aria-invalid:-outline-offset-[1.5px] aria-invalid:outline-ink-2",
  "aria-invalid:focus-visible:outline-2 aria-invalid:focus-visible:outline-offset-0 aria-invalid:focus-visible:outline-focus-ring",
].join(" ");

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
    <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
      <input
        ref={inputRef}
        type="text"
        className={RENAME_CLASS}
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
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-small leading-tight font-semibold text-ink"
          role="alert"
        >
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
  /** Resolves when the delete is over, done or refused; the dialog can't be closed meanwhile. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** Google's confirm: the calendar's events go with it. */
export function DeleteCalendarDialog({ calendar, isOnly, onConfirm, onClose }: DeleteCalendarDialogProps) {
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Delete calendar"
      message={
        <p className="text-body leading-body text-ink">{`Delete "${calendar.name}"? Its events will be deleted too.`}</p>
      }
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      onConfirm={onConfirm}
      confirmDisabled={isOnly}
      confirmTitle={LAST_CALENDAR_REASON}
    >
      {isOnly && <p className="mt-3 text-meta leading-body text-muted">{LAST_CALENDAR_REASON}</p>}
    </ConfirmDialog>
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
  // After Enter or Esc in the name field, focus goes back to the row's checkbox, not to the page.
  const restoreFocus = useRef(false);
  const color = calendarColor(calendar);
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming || !restoreFocus.current) return;
    restoreFocus.current = false;
    checkboxRef.current?.focus();
  }, [renaming]);

  const stopRenaming = (viaKeyboard: boolean) => {
    restoreFocus.current = viaKeyboard;
    setRenaming(false);
  };

  const sections = rowMenuSections(calendar, isOnly, {
    rename: () => setRenaming(true),
    chooseColor: () => setChoosingColor(true),
    remove: () => setDeleting(true),
  });

  return (
    <li
      ref={setRowElement}
      className="group flex min-h-9 items-center gap-1 rounded-control pr-1 focus-within:bg-hover hover:bg-hover max-md:min-h-(--size-touch)"
      style={{ "--calendar-color": color, "--on-calendar": calendarInk(calendar.color) } as CSSProperties}
      data-renaming={renaming || undefined}
    >
      <label className="relative flex min-w-0 flex-1 cursor-pointer items-center gap-3 self-stretch pl-1 text-meta text-ink group-data-renaming:flex-none max-md:text-body">
        <input
          ref={checkboxRef}
          type="checkbox"
          className="peer pointer-events-none absolute m-0 size-px opacity-0"
          checked={calendar.visible}
          onChange={(event) => onVisibleChange(event.currentTarget.checked)}
        />
        <span
          className="flex size-5 flex-none items-center justify-center rounded-event border-2 border-(color:--calendar-color) text-(color:--on-calendar) peer-checked:bg-(color:--calendar-color) peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
          aria-hidden="true"
        >
          <CheckIcon size={12} strokeWidth={3.5} />
        </span>
        <span
          className={renaming ? "sr-only" : "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"}
          title={renaming ? undefined : calendar.name}
        >
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
          triggerClassName={cn(ICON_BUTTON_SMALL, MORE_CLASS)}
          align="end"
          trigger={<MoreIcon />}
          sections={sections}
        />
      )}
      {choosingColor && rowElement && (
        <Popover
          anchor={rowElement}
          onClose={() => setChoosingColor(false)}
          label={`Colour of ${calendar.name}`}
          className="p-4"
        >
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
          onConfirm={onDelete}
          onClose={() => setDeleting(false)}
        />
      )}
    </li>
  );
}
