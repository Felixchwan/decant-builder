import { describe, expect, it, vi } from "vitest";

import { createGenerationRunner, FRAME_STALL_MS, scheduleAfterPaint } from "./generationRunner.js";

// A scheduler the test controls: nothing runs until flush() is called, which
// stands in for "the browser has painted and the next task begins".
function createManualScheduler() {
  const queue = [];
  const cancelled = [];
  const schedule = (callback) => {
    const entry = { callback };
    queue.push(entry);
    return () => {
      cancelled.push(entry);
      const index = queue.indexOf(entry);
      if (index >= 0) queue.splice(index, 1);
    };
  };
  return {
    schedule,
    pending: () => queue.length,
    cancelled: () => cancelled.length,
    flush: () => {
      const entry = queue.shift();
      entry?.callback();
    },
  };
}

// A fake browser environment with a controllable frame/timer queue.
function createFakeEnvironment({ withFrames = true } = {}) {
  let nextId = 1;
  const frames = new Map();
  const timers = new Map();
  const environment = {
    setTimeout: (callback, delay) => {
      const id = nextId++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
  };
  if (withFrames) {
    environment.requestAnimationFrame = (callback) => {
      const id = nextId++;
      frames.set(id, callback);
      return id;
    };
    environment.cancelAnimationFrame = (id) => {
      frames.delete(id);
    };
  }
  return {
    environment,
    frameCount: () => frames.size,
    timerDelays: () => [...timers.values()].map((timer) => timer.delay),
    runFrame: () => {
      const [id, callback] = frames.entries().next().value || [];
      if (id === undefined) return;
      frames.delete(id);
      callback();
    },
    runTimer: (delay) => {
      const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
      if (!entry) return;
      timers.delete(entry[0]);
      entry[1].callback();
    },
  };
}

describe("scheduleAfterPaint", () => {
  it("does not run the callback until a frame has been produced AND a later task starts", () => {
    const fake = createFakeEnvironment();
    const callback = vi.fn();
    scheduleAfterPaint(callback, fake.environment);

    expect(callback).not.toHaveBeenCalled();
    fake.runFrame();
    // Inside the frame callback (before paint) the work must still not have run.
    expect(callback).not.toHaveBeenCalled();
    fake.runTimer(0);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("never runs the callback twice, even if the stall guard and the frame path both fire", () => {
    const fake = createFakeEnvironment();
    const callback = vi.fn();
    scheduleAfterPaint(callback, fake.environment);

    fake.runFrame();
    fake.runTimer(0);
    fake.runTimer(FRAME_STALL_MS);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("falls back to the stall guard when frames never fire (hidden/occluded document)", () => {
    const fake = createFakeEnvironment();
    const callback = vi.fn();
    scheduleAfterPaint(callback, fake.environment);

    expect(callback).not.toHaveBeenCalled();
    fake.runTimer(FRAME_STALL_MS);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cancels the stall guard once a frame arrives, so the frame path always wins when painting works", () => {
    const fake = createFakeEnvironment();
    scheduleAfterPaint(vi.fn(), fake.environment);
    expect(fake.timerDelays()).toEqual([FRAME_STALL_MS]);
    fake.runFrame();
    expect(fake.timerDelays()).toEqual([0]);
  });

  it("degrades to a plain macrotask without requestAnimationFrame", () => {
    const fake = createFakeEnvironment({ withFrames: false });
    const callback = vi.fn();
    scheduleAfterPaint(callback, fake.environment);
    expect(fake.timerDelays()).toEqual([0]);
    fake.runTimer(0);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cancel prevents the callback in every phase", () => {
    const beforeFrame = createFakeEnvironment();
    const cb1 = vi.fn();
    scheduleAfterPaint(cb1, beforeFrame.environment)();
    expect(beforeFrame.frameCount()).toBe(0);
    expect(beforeFrame.timerDelays()).toEqual([]);

    const afterFrame = createFakeEnvironment();
    const cb2 = vi.fn();
    const cancel = scheduleAfterPaint(cb2, afterFrame.environment);
    afterFrame.runFrame();
    cancel();
    afterFrame.runTimer(0);
    afterFrame.runTimer(FRAME_STALL_MS);
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });
});

describe("createGenerationRunner", () => {
  it("enters the loading state (onStart) synchronously, before any work runs", () => {
    const scheduler = createManualScheduler();
    const runner = createGenerationRunner({ schedule: scheduler.schedule });
    const order = [];

    runner.run({
      onStart: () => order.push("start"),
      work: () => {
        order.push("work");
        return "result";
      },
      onSuccess: () => order.push("success"),
    });

    expect(order).toEqual(["start"]);
    expect(runner.isRunning()).toBe(true);
    scheduler.flush();
    expect(order).toEqual(["start", "work", "success"]);
  });

  it("loading is observable before the result is committed", () => {
    const scheduler = createManualScheduler();
    const runner = createGenerationRunner({ schedule: scheduler.schedule });
    let loading = false;
    let proposal = null;
    const snapshots = [];

    runner.run({
      onStart: () => {
        loading = true;
      },
      work: () => ({ boxes: 2 }),
      onSuccess: (result) => {
        proposal = result;
      },
      onSettled: () => {
        loading = false;
      },
    });

    // The "paint" happens here: loading is visible, no proposal yet.
    snapshots.push({ loading, proposal });
    scheduler.flush();
    snapshots.push({ loading, proposal });

    expect(snapshots).toEqual([
      { loading: true, proposal: null },
      { loading: false, proposal: { boxes: 2 } },
    ]);
  });

  it("refuses a second run while one is in flight, so duplicate clicks cannot start duplicate generation", () => {
    const scheduler = createManualScheduler();
    const runner = createGenerationRunner({ schedule: scheduler.schedule });
    const work = vi.fn(() => "ok");
    const onStart = vi.fn();

    expect(runner.run({ work, onStart })).toBe(true);
    expect(runner.run({ work, onStart })).toBe(false);
    expect(runner.run({ work, onStart })).toBe(false);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(scheduler.pending()).toBe(1);

    scheduler.flush();
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("allows a new run once the previous one has settled", () => {
    const scheduler = createManualScheduler();
    const runner = createGenerationRunner({ schedule: scheduler.schedule });
    const work = vi.fn(() => "ok");

    runner.run({ work });
    scheduler.flush();
    expect(runner.isRunning()).toBe(false);
    expect(runner.run({ work })).toBe(true);
    scheduler.flush();
    expect(work).toHaveBeenCalledTimes(2);
  });

  it("routes a thrown error to onFailure, still settles, and is usable again", () => {
    const scheduler = createManualScheduler();
    const runner = createGenerationRunner({ schedule: scheduler.schedule });
    const boom = new Error("boom");
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const onSettled = vi.fn();

    runner.run({
      work: () => {
        throw boom;
      },
      onSuccess,
      onFailure,
      onSettled,
    });
    scheduler.flush();

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith(boom);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(runner.isRunning()).toBe(false);
    expect(runner.run({ work: () => 1 })).toBe(true);
  });

  it("cancel discards the pending run without ever doing the work", () => {
    const scheduler = createManualScheduler();
    const runner = createGenerationRunner({ schedule: scheduler.schedule });
    const work = vi.fn();
    const onSuccess = vi.fn();
    const onSettled = vi.fn();

    runner.run({ work, onSuccess, onSettled });
    runner.cancel();

    expect(scheduler.cancelled()).toBe(1);
    expect(runner.isRunning()).toBe(false);
    scheduler.flush();
    expect(work).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("discards the result of a run cancelled while its work was executing", () => {
    const scheduler = createManualScheduler();
    const runner = createGenerationRunner({ schedule: scheduler.schedule });
    const onSuccess = vi.fn();
    const onSettled = vi.fn();

    runner.run({
      work: () => {
        runner.cancel();
        return "stale";
      },
      onSuccess,
      onSettled,
    });
    scheduler.flush();

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onSettled).not.toHaveBeenCalled();
    expect(runner.isRunning()).toBe(false);
  });

  it("a cancelled run does not block, or leak into, the next run", () => {
    const scheduler = createManualScheduler();
    const runner = createGenerationRunner({ schedule: scheduler.schedule });
    const firstSuccess = vi.fn();
    const secondSuccess = vi.fn();

    runner.run({ work: () => "first", onSuccess: firstSuccess });
    runner.cancel();
    expect(runner.run({ work: () => "second", onSuccess: secondSuccess })).toBe(true);
    scheduler.flush();

    expect(firstSuccess).not.toHaveBeenCalled();
    expect(secondSuccess).toHaveBeenCalledWith("second");
  });
});
