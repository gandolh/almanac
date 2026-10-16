import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { isApiError } from "../api";
import { AuthField } from "../auth/Field";
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { CheckIcon } from "../components/icons";
import { useSettings } from "../data/settings";
import { listTimeZones, matchesZone, zoneEntry, type ZoneEntry } from "./time-zones";
import "../auth/auth.css";
import "./time-zone.css";

export interface TimeZoneDialogProps {
  open: boolean;
  onClose(): void;
}

/**
 * The account menu's "Time zone…" (corpus/wiki/features.md "Account menu",
 * decisions.md "One display time zone per user"): the current zone, a search
 * over every zone the browser lists (by city, region or offset), and Save.
 * Times show in the chosen zone wherever the user is, so the device's own
 * zone doesn't come into it. The views follow through the settings store once
 * the server has the change.
 *
 * Closed, it renders nothing; each opening starts afresh (the search empty,
 * the current zone chosen).
 */
export function TimeZoneDialog({ open, onClose }: TimeZoneDialogProps) {
  return open ? <OpenTimeZoneDialog onClose={onClose} /> : null;
}

function OpenTimeZoneDialog({ onClose }: Pick<TimeZoneDialogProps, "onClose">) {
  const { timeZone, setTimeZone } = useSettings();
  // Offsets are as of this moment: a zone in daylight saving shows its summer offset.
  const [now] = useState(() => Date.now());
  const entries = useMemo(() => listTimeZones(now), [now]);
  const current = useMemo(() => entryOrNull(timeZone, now), [timeZone, now]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(timeZone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const listRef = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => entries.filter((entry) => matchesZone(entry, query)), [entries, query]);

  const save = async () => {
    if (saving || selected === timeZone) return;
    setSaving(true);
    setError(undefined);
    try {
      await setTimeZone(selected);
      onClose();
    } catch (failure) {
      setError(isApiError(failure, "network") ? failure.message : "Couldn't save the time zone. Try again.");
      setSaving(false);
    }
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      listRef.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus();
    } else if (event.key === "Enter") {
      // Enter picks the first match; Enter again, with the pick made, saves it.
      event.preventDefault();
      const first = matches[0];
      if (first && first.zone !== selected) setSelected(first.zone);
      else void save();
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Time zone"
      size="small"
      dismissOnBackdrop={false}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving || selected === timeZone}>
            Save
          </Button>
        </>
      }
    >
      <div className="zone-dialog">
        <p className="zone-dialog__intro">Times show in this time zone wherever you are.</p>
        <div className="zone-current">
          <span className="zone-current__caption">Current time zone</span>
          <span className="zone-current__label">{current?.label ?? timeZone}</span>
          {current && <span className="zone-current__zone">{current.zone}</span>}
        </div>
        <AuthField
          label="Search"
          type="text"
          placeholder="City, region or offset"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKeyDown}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          data-autofocus=""
        />
        <ZoneList entries={matches} selected={selected} onSelect={setSelected} listRef={listRef} />
        {error !== undefined && (
          <p className="zone-dialog__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function entryOrNull(zone: string, now: number): ZoneEntry | null {
  try {
    return zoneEntry(zone, now);
  } catch {
    return null;
  }
}

export interface ZoneListProps {
  entries: readonly ZoneEntry[];
  /** The zone chosen, which need not be among `entries` (a search may hide it). */
  selected: string;
  onSelect: (zone: string) => void;
  listRef?: RefObject<HTMLDivElement | null>;
}

/**
 * The zones as a radio group: "(GMT+03:00) Bucharest" over "Europe/Bucharest".
 * One row is in the Tab order (the chosen one, else the first); ↑ ↓ Home End
 * move and choose. It opens scrolled to the chosen zone.
 */
export function ZoneList({ entries, selected, onSelect, listRef }: ZoneListProps) {
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = listRef ?? ownRef;
  const tabbable = entries.some((entry) => entry.zone === selected) ? selected : entries[0]?.zone;

  // A passive effect, not a layout one: the dialog is shown (and so measurable) in its own layout effect, which runs after this child's.
  useEffect(() => {
    const list = ref.current;
    const chosen = list?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (list && chosen) list.scrollTop = chosen.offsetTop - (list.clientHeight - chosen.offsetHeight) / 2;
  }, [ref]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const index = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = Math.min(index + 1, rows.length - 1);
        break;
      case "ArrowUp":
        next = Math.max(index - 1, 0);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = rows.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const row = rows[next];
    row?.focus();
    if (row?.dataset.zone) onSelect(row.dataset.zone);
  };

  if (entries.length === 0) {
    return (
      <p className="zone-list__empty" role="status">
        No time zone matches that.
      </p>
    );
  }

  return (
    <div ref={ref} className="zone-list" role="radiogroup" aria-label="Time zones" onKeyDown={onKeyDown}>
      {entries.map((entry) => {
        const chosen = entry.zone === selected;
        return (
          <button
            key={entry.zone}
            type="button"
            role="radio"
            aria-checked={chosen}
            tabIndex={entry.zone === tabbable ? 0 : -1}
            data-zone={entry.zone}
            className="zone-option"
            onClick={() => onSelect(entry.zone)}
          >
            <span className="zone-option__tick">{chosen && <CheckIcon size={18} />}</span>
            <span className="zone-option__text">
              <span className="zone-option__label">{entry.label}</span>
              <span className="zone-option__zone">{entry.zone}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
