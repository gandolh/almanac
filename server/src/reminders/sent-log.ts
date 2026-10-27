import type { Db } from "../db/open.js";

/**
 * The reminders already sent (brief 16): `reminders_sent`, keyed by the event
 * row and the occurrence's start, so a reminder goes once whichever tick or
 * process sees it first. For an occurrence a series generates the row is the
 * series and the start its key; a one-off or an exception is its own row.
 * Rows go with their event, and the timer drops them after a few days.
 */
export interface SentLog {
  /**
   * Claims a reminder before it is sent: true when this call recorded it,
   * false when it was recorded already. Claiming first is what keeps two
   * ticks, or two processes, from both sending it.
   */
  claim(eventId: number, occurrenceStart: string, at: number): boolean;
  /** Drops what was sent before `before` (epoch ms). Answers how many went. */
  prune(before: number): number;
}

export function createSentLog(db: Db): SentLog {
  const insert = db.prepare<[number, string, number]>(
    "INSERT OR IGNORE INTO reminders_sent (event_id, occurrence_start, sent_at) VALUES (?, ?, ?)",
  );
  const drop = db.prepare<[number]>("DELETE FROM reminders_sent WHERE sent_at < ?");
  return {
    claim: (eventId, occurrenceStart, at) => insert.run(eventId, occurrenceStart, at).changes > 0,
    prune: (before) => drop.run(before).changes,
  };
}
