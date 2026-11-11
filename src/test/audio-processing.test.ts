import { describe, expect, it } from "vitest";
import {
  makeSeamless,
  prepareChannels,
  MAX_SAMPLE_PEAK,
  TARGET_RMS,
} from "@/services/audio/processing";
import {
  hasSynth,
  LOOP_SECONDS,
  synthesizeStereo,
} from "@/services/audio/synth";
import { audioSources } from "@/config/audio-sources";
import { sounds } from "@/data/sounds";

function stats(channel: Float32Array) {
  let mean = 0;
  let power = 0;
  let peak = 0;
  let lag = 0;
  for (let i = 0; i < channel.length; i++) {
    const value = channel[i]!;
    mean += value;
    power += value * value;
    peak = Math.max(peak, Math.abs(value));
    if (i) lag += value * channel[i - 1]!;
  }
  return {
    mean: mean / channel.length,
    rms: Math.sqrt(power / channel.length),
    peak,
    correlation: lag / power,
  };
}

const tone = (n: number, amplitude = 0.4, dc = 0.2) =>
  Float32Array.from(
    { length: n },
    (_, i) => dc + amplitude * Math.sin((2 * Math.PI * i) / 80),
  );

describe("professional audio PCM", () => {
  it("covers all 20 catalogue ids with exactly one new source type", () => {
    expect(sounds).toHaveLength(20);
    for (const sound of sounds) {
      expect(Boolean(audioSources[sound.id]) !== hasSynth(sound.id)).toBe(true);
    }
    expect(Object.keys(audioSources)).toHaveLength(17);
  });

  it("creates an overlap without a silent edge or mutating the source", () => {
    const input = tone(24000);
    const copy = input.slice();
    const output = makeSeamless(input, 16000);
    expect(output).toHaveLength(16000);
    expect(output[0]).toBeCloseTo(input[16000]!);
    expect(output[7999]).toBeCloseTo(input[7999]!);
    expect(input).toEqual(copy);
    expect(Math.abs(output[0]! - output[15999]!)).toBeLessThan(0.04);
  });

  it("removes DC and calibrates energy with shared stereo gain", () => {
    const output = prepareChannels([tone(24000), tone(24000, 0.2)], 8000, 1);
    const left = stats(output[0]!);
    const right = stats(output[1]!);
    expect(Math.abs(left.mean)).toBeLessThan(1e-7);
    expect(Math.abs(right.mean)).toBeLessThan(1e-7);
    expect(left.rms / right.rms).toBeCloseTo(2);
    expect(Math.sqrt((left.rms ** 2 + right.rms ** 2) / 2)).toBeCloseTo(
      TARGET_RMS,
      4,
    );
    expect(Math.max(left.peak, right.peak)).toBeLessThanOrEqual(
      MAX_SAMPLE_PEAK + 1e-6,
    );
  });

  it("protects transient peaks and rejects silence or corrupted data", () => {
    const transient = new Float32Array(24000);
    transient[6000] = 100;
    expect(
      stats(prepareChannels([transient], 8000)[0]!).peak,
    ).toBeLessThanOrEqual(MAX_SAMPLE_PEAK + 1e-6);
    expect(() => prepareChannels([new Float32Array(24000)], 8000)).toThrow(
      /silencioso/,
    );
    expect(() => prepareChannels([new Float32Array([NaN, 1])], 8000)).toThrow(
      /inválidas/,
    );
    expect(() => makeSeamless(tone(20), 21)).toThrow();
    expect(() => prepareChannels([tone(20)], 8000, -1)).toThrow();
  });

  it("generates long distinct stereo noises without aliases to environmental sounds", () => {
    const correlations: number[] = [];
    for (const id of ["white", "pink", "brown"]) {
      const [left, right] = synthesizeStereo(id, 8000);
      expect(left).toHaveLength(LOOP_SECONDS * 8000);
      expect(right).toHaveLength(LOOP_SECONDS * 8000);
      expect(left).not.toEqual(right);
      const measured = stats(left!);
      expect(Math.abs(measured.mean)).toBeLessThan(1e-7);
      expect(measured.peak).toBeLessThanOrEqual(MAX_SAMPLE_PEAK + 1e-6);
      expect(measured.rms).toBeGreaterThan(0.02);
      correlations.push(measured.correlation);
    }
    // Increasing time correlation is expected as energy moves toward low frequencies.
    expect(correlations[1]!).toBeGreaterThan(correlations[0]!);
    expect(correlations[2]!).toBeGreaterThan(correlations[1]!);
    expect(() => synthesizeStereo("rain", 8000)).toThrow(/desconhecido/);
    expect(() => synthesizeStereo("pink", 0)).toThrow(/amostragem/);
  });
});
