import type { EditScope, Occurrence } from "@almanac/shared";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { deleteOccurrence, type DeleteSteps } from "./delete-occurrence";

const oneOff: Occurrence = {
  id: "e4",
  eventId: 4,
  seriesId: null,
  originalStart: null,
  calendarId: 1,
  title: "Dentist",
  location: "",
  notes: "",
  allDay: false,
  start: "2026-10-16T07:00:00Z",
  end: "2026-10-16T08:00:00Z",
  repeat: null,
  reminderMinutes: null,
};

/** The third Monday of a weekly series, moved an hour later (an exception). */
const moved: Occurrence = {
  ...oneOff,
  id: "e9",
  eventId: 9,
  seriesId: 7,
  originalStart: "2026-10-19T07:00:00Z",
  start: "2026-10-19T08:00:00Z",
  end: "2026-10-19T09:00:00Z",
  repeat: { freq: "weekly", end: { type: "never" } },
};

function steps(answer: EditScope | null, failure?: unknown) {
  return {
    askScope: vi.fn<DeleteSteps["askScope"]>(async () => answer),
    deleteEvent: vi.fn<DeleteSteps["deleteEvent"]>(async () => {
      if (failure !== undefined) throw failure;
    }),
    notifyOccurrencesChanged: vi.fn<DeleteSteps["notifyOccurrencesChanged"]>(),
  };
}

describe("deleteOccurrence", () => {
  it("deletes a one-off at once, without the scope question", async () => {
    const fake = steps("all");
    expect(await deleteOccurrence(oneOff, fake)).toEqual({ outcome: "deleted" });
    expect(fake.askScope).not.toHaveBeenCalled();
    expect(fake.deleteEvent).toHaveBeenCalledWith(4, {});
  });

  it("asks the scope for a series' occurrence and names it by its original start", async () => {
    const fake = steps("following");
    expect(await deleteOccurrence(moved, fake)).toEqual({ outcome: "deleted" });
    expect(fake.askScope).toHaveBeenCalledWith({ action: "delete", allowThis: true });
    expect(fake.deleteEvent).toHaveBeenCalledWith(9, { scope: "following", occurrence: "2026-10-19T07:00:00Z" });
  });

  it("deletes nothing when the scope question is backed out of", async () => {
    const fake = steps(null);
    expect(await deleteOccurrence(moved, fake)).toEqual({ outcome: "cancelled" });
    expect(fake.deleteEvent).not.toHaveBeenCalled();
  });

  it("counts an event already gone as deleted, and has the views fetch again", async () => {
    const fake = steps(null, new ApiError(404, "not_found", "That event doesn't exist."));
    expect(await deleteOccurrence(oneOff, fake)).toEqual({ outcome: "deleted" });
    expect(fake.notifyOccurrencesChanged).toHaveBeenCalledOnce();
  });

  it("hands back the server's reason, or a plain one, when the delete fails", async () => {
    const refused = steps(null, new ApiError(500, "internal", "Something went wrong on our side."));
    expect(await deleteOccurrence(oneOff, refused)).toEqual({ outcome: "failed", message: "Something went wrong on our side." });
    expect(refused.notifyOccurrencesChanged).not.toHaveBeenCalled();

    const broken = steps(null, new TypeError("Failed to fetch"));
    expect(await deleteOccurrence(oneOff, broken)).toEqual({ outcome: "failed", message: "The event couldn't be deleted. Try again." });
  });
});
