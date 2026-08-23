import { describe, expect, it } from "vitest";
import { waitForAccurateGps } from "./accuracyWait";

describe("waitForAccurateGps", () => {
  it("returns immediately when the first fix meets the target", async () => {
    const coords = await waitForAccurateGps(async () => ({
      latitude: 25.3,
      longitude: 82.9,
      accuracy: 12,
    }));
    expect(coords.accuracy).toBe(12);
  });

  it("keeps reading until accuracy improves to the target", async () => {
    const readings = [180, 90, 40];
    const coords = await waitForAccurateGps(
      async () => ({
        latitude: 25.3,
        longitude: 82.9,
        accuracy: readings.shift() ?? 40,
      }),
      { sleep: async () => undefined, timeoutMs: 10_000, pollMs: 1 },
    );
    expect(coords.accuracy).toBe(40);
  });

  it("returns the best fix under the server max when time runs out", async () => {
    let t = 0;
    const coords = await waitForAccurateGps(
      async () => ({ latitude: 25.3, longitude: 82.9, accuracy: 120 }),
      {
        targetMeters: 50,
        maxMeters: 200,
        timeoutMs: 50,
        pollMs: 1,
        now: () => t,
        sleep: async () => {
          t += 1000;
        },
      },
    );
    expect(coords.accuracy).toBe(120);
  });

  it("throws when the best fix is worse than the server max", async () => {
    let t = 0;
    await expect(
      waitForAccurateGps(
        async () => ({ latitude: 25.3, longitude: 82.9, accuracy: 350 }),
        {
          timeoutMs: 50,
          pollMs: 1,
          now: () => t,
          sleep: async () => {
            t += 1000;
          },
        },
      ),
    ).rejects.toThrow(/GPS signal too weak/);
  });
});
