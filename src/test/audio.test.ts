import { describe, expect, it } from "vitest";
import { makeSeamless, synthesize, LOOP_SECONDS } from "@/services/audio/synth";
import { validatePreset } from "@/services/audio/presets";
import { formatRemaining } from "@/services/audio/sleep-timer";

describe("audio", () => {
  it("loop seam blends tail into head", () => {
    const a = new Float32Array(150).map((_, i) => i);
    const out = makeSeamless(a, 100);
    expect(out.length).toBe(100);
    expect(out[0]).toBeCloseTo(100);
  });
  it("synthesizes a 12s loop", () => {
    expect(synthesize("rain", 8000).length).toBe(LOOP_SECONDS * 8000);
  });
  it("presets need a name (max 40) and at least one sound", () => {
    expect(() => validatePreset("  ", [{ soundId: "rain", volume: 70 }])).toThrow();
    expect(() => validatePreset("Noite", [])).toThrow();
    expect(() => validatePreset("x".repeat(41), [{ soundId: "rain", volume: 70 }])).toThrow();
    expect(validatePreset(" Noite ", [{ soundId: "rain", volume: 70 }])).toBe("Noite");
  });
  it("timer formats remaining time", () => {
    expect(formatRemaining(30 * 60_000)).toBe("30:00");
    expect(formatRemaining(61_500)).toBe("1:02");
  });
});
