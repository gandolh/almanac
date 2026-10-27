import { afterEach, describe, expect, it, vi } from "vitest";
import { startTestApp } from "../testing/testApp.js";
import { vapidEnv } from "../testing/vapid.js";
import { TICK_MS, startReminderTimer, type Reminders } from "./timer.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("the reminder timer", () => {
  it("ticks once a minute, skips a tick while one is running, logs a failure and carries on", async () => {
    vi.useFakeTimers();
    let release: () => void = () => undefined;
    const tick = vi
      .fn<Reminders["tick"]>()
      .mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve({ sent: 0 }))))
      .mockRejectedValueOnce(new Error("the database is locked"))
      .mockResolvedValue({ sent: 0 });
    const log = { error: vi.fn() };
    const timer = startReminderTimer({ tick }, log);

    await vi.advanceTimersByTimeAsync(TICK_MS - 1);
    expect(tick).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(tick).toHaveBeenCalledTimes(1);
    // Still running a minute later: that tick is skipped.
    await vi.advanceTimersByTimeAsync(TICK_MS);
    expect(tick).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(TICK_MS);
    expect(tick).toHaveBeenCalledTimes(2);
    expect(log.error).toHaveBeenCalledWith({ err: expect.any(Error) }, "reminders tick failed");
    await vi.advanceTimersByTimeAsync(TICK_MS);
    expect(tick).toHaveBeenCalledTimes(3);

    await timer.stop();
    await vi.advanceTimersByTimeAsync(5 * TICK_MS);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it("stop waits for a tick that is running", async () => {
    vi.useFakeTimers();
    let done = false;
    const tick = vi.fn<Reminders["tick"]>(
      () => new Promise((resolve) => setTimeout(() => ((done = true), resolve({ sent: 0 })), 5000)),
    );
    const timer = startReminderTimer({ tick }, { error: vi.fn() });
    await vi.advanceTimersByTimeAsync(TICK_MS);
    const stopped = timer.stop();
    await vi.advanceTimersByTimeAsync(5000);
    await stopped;
    expect(done).toBe(true);
  });

  it("runs in an app with push on, and closes with it", async () => {
    const t = await startTestApp(vapidEnv());
    await expect(t.close()).resolves.toBeUndefined();
  });
});
