import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { isApiError } from "../api";
import { AuthField } from "../components/Field";
import { Button } from "../components/Button";
import { Dialog } from "../components/ui/Dialog";
import { RadioGroup, RadioIndicator, RadioItem } from "../components/ui/RadioGroup";
import { CheckIcon } from "../components/icons";
import { useSettings } from "../data/settings";
import { listTimeZones, matchesZone, zoneEntry, type ZoneEntry } from "./time-zones";

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
      <div className="flex flex-col gap-4">
        <p className="text-meta leading-body text-ink-2">Times show in this time zone wherever you are.</p>
        <div className="flex flex-col gap-0.5 rounded-control bg-accent-tint-soft px-3 py-2.5 text-accent-ink">
          <span className="text-label font-semibold">Current time zone</span>
          <span className="text-body font-medium">{current?.label ?? timeZone}</span>
          {current && <span className="text-small">{current.zone}</span>}
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
          <p className="text-small font-semibold text-ink" role="alert">
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

  // A passive effect, not a layout one: the dialog is shown (and so measurable) in its own layout effect, which runs after this child's.
  useEffect(() => {
    const list = ref.current;
    const chosen = list?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (list && chosen) list.scrollTop = chosen.offsetTop - (list.clientHeight - chosen.offsetHeight) / 2;
  }, [ref]);

  if (entries.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-meta text-muted" role="status">
        No time zone matches that.
      </p>
    );
  }

  return (
    <RadioGroup<string>
      ref={ref}
      className="relative h-[min(320px,40dvh)] overflow-y-auto overscroll-contain rounded-control border border-hairline"
      aria-label="Time zones"
      value={selected}
      onValueChange={onSelect}
    >
      {entries.map((entry) => (
        <RadioItem
          key={entry.zone}
          value={entry.zone}
          data-zone={entry.zone}
          className="flex min-h-12 w-full items-center gap-3 bg-transparent px-3 py-1.5 text-left text-ink hover:bg-hover focus-visible:-outline-offset-2 data-checked:bg-accent-tint-soft data-checked:hover:bg-accent-tint-soft"
        >
          <span className="flex w-[18px] flex-none text-accent">
            <RadioIndicator>
              <CheckIcon size={18} />
            </RadioIndicator>
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-meta max-md:text-body">{entry.label}</span>
            <span className="text-small text-muted">{entry.zone}</span>
          </span>
        </RadioItem>
      ))}
    </RadioGroup>
  );
}
