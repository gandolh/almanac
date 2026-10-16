import type { Occurrence } from "@almanac/shared";
import { isApiError } from "../api";
import { deleteEvent, notifyOccurrencesChanged, type DeleteOptions } from "../data/occurrences";
import { askScope } from "./scope";

/**
 * Deleting an occurrence, for the details popover's Delete and the event
 * form's: a series' occurrence (or an exception) asks the edit scope first,
 * a one-off goes at once. What the user is told is the caller's: the popover
 * toasts, the form says a failure under its fields, where a toast would sit
 * under the dialog.
 */

/** How a delete ended: done (or already gone), backed out of at the scope question, or refused with the reason to show. */
export type DeleteResult = { outcome: "deleted" } | { outcome: "cancelled" } | { outcome: "failed"; message: string };

/** What a delete does along the way; the tests hand in their own. */
export interface DeleteSteps {
  askScope: typeof askScope;
  deleteEvent: typeof deleteEvent;
  notifyOccurrencesChanged: typeof notifyOccurrencesChanged;
}

const STEPS: DeleteSteps = { askScope, deleteEvent, notifyOccurrencesChanged };

export async function deleteOccurrence(occurrence: Occurrence, steps: DeleteSteps = STEPS): Promise<DeleteResult> {
  let options: DeleteOptions = {};
  if (occurrence.seriesId !== null) {
    const scope = await steps.askScope({ action: "delete", allowThis: true });
    if (scope === null) return { outcome: "cancelled" };
    options = { scope, occurrence: occurrence.originalStart ?? occurrence.start };
  }
  try {
    await steps.deleteEvent(occurrence.eventId, options);
  } catch (error) {
    // Already gone (deleted in another tab): as good as deleted; the views fetch again.
    if (isApiError(error, "not_found")) {
      steps.notifyOccurrencesChanged();
      return { outcome: "deleted" };
    }
    return { outcome: "failed", message: isApiError(error) ? error.message : "The event couldn't be deleted. Try again." };
  }
  return { outcome: "deleted" };
}
