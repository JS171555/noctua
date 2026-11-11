import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioLoader } from "@/services/audio/loader";
import { generateNoiseChannels } from "@/services/audio/noise-client";

vi.mock("@/services/audio/noise-client", () => ({
  generateNoiseChannels: vi.fn(),
}));

function context() {
  const samples = Float32Array.from(
    { length: 32000 },
    (_, i) => Math.sin(i * 0.3) * 0.2,
  );
  const decoded = {
    sampleRate: 8000,
    numberOfChannels: 2,
    length: samples.length,
    getChannelData: () => samples,
  };
  const createBuffer = vi.fn(
    (channels: number, length: number, sampleRate: number) => ({
      length,
      sampleRate,
      numberOfChannels: channels,
      duration: length / sampleRate,
      copyToChannel: vi.fn(),
    }),
  );
  const decodeAudioData = vi.fn(async () => decoded);
  return {
    ctx: {
      sampleRate: 8000,
      createBuffer,
      decodeAudioData,
    } as unknown as BaseAudioContext,
    createBuffer,
    decodeAudioData,
  };
}
const response = () => ({
  ok: true,
  arrayBuffer: async () => new ArrayBuffer(16),
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("audio loading", () => {
  it("deduplicates pending loads, caches decoded audio and removes the overlap", async () => {
    const { ctx, createBuffer } = context();
    const fetch = vi.fn(async (_url: string, _options?: RequestInit) =>
      response(),
    );
    vi.stubGlobal("fetch", fetch);
    const loader = new AudioLoader(ctx);
    const a = loader.load("rain");
    const b = loader.load("rain");
    expect(a).toBe(b);
    const buffer = await a;
    expect(await loader.load("rain")).toBe(buffer);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe("/audio/v2/rain.mp3?rev=4");
    expect(createBuffer).toHaveBeenCalledWith(2, 24000, 8000);
    loader.clear();
    await loader.load("rain");
    expect(fetch).toHaveBeenCalledTimes(2);
    loader.clear();
  });

  it("evicts the least recently used decoded buffer within the memory budget", async () => {
    const { ctx, createBuffer } = context();
    // Virtual lengths test accounting without allocating 96 MiB of real PCM.
    createBuffer.mockImplementation((channels, _length, sampleRate) => ({
      length: 6 * 1024 * 1024,
      sampleRate,
      numberOfChannels: channels,
      duration: (6 * 1024 * 1024) / sampleRate,
      copyToChannel: vi.fn(),
    }));
    const fetch = vi.fn(async (_url: string) => response());
    vi.stubGlobal("fetch", fetch);
    const loader = new AudioLoader(ctx);
    const rain = await loader.load("rain");
    await loader.load("ocean");
    expect(await loader.load("rain")).toBe(rain);
    await loader.load("wind");
    expect(await loader.load("rain")).toBe(rain);
    await loader.load("ocean");
    expect(fetch).toHaveBeenCalledTimes(4);
    loader.clear();
  });

  it("reports failed requests and allows a real retry without synthetic substitutions", async () => {
    const { ctx, decodeAudioData } = context();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue(response());
    vi.stubGlobal("fetch", fetch);
    const loader = new AudioLoader(ctx);
    await expect(loader.load("ocean")).rejects.toThrow("503");
    await expect(loader.load("ocean")).resolves.toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
    expect(generateNoiseChannels).not.toHaveBeenCalled();
    await expect(loader.load("missing")).rejects.toThrow(/desconhecido/);
    loader.clear();
  });

  it("bounds concurrent downloads and cancels queued and active requests on teardown", async () => {
    const { ctx } = context();
    const gates = [
      deferred<ReturnType<typeof response>>(),
      deferred<ReturnType<typeof response>>(),
    ];
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => gates[0]!.promise)
      .mockImplementationOnce(() => gates[1]!.promise);
    vi.stubGlobal("fetch", fetch);
    const loader = new AudioLoader(ctx);
    const active = [loader.load("rain"), loader.load("ocean")];
    const queued = loader.load("wind");
    const checks = [...active, queued].map((promise) =>
      expect(promise).rejects.toThrow(/cancelado/),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    loader.clear();
    gates.forEach((gate) => gate.resolve(response()));
    await Promise.all(checks);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("uses the noise worker path without fetching and preserves both channels", async () => {
    const { ctx, createBuffer } = context();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.mocked(generateNoiseChannels).mockResolvedValue([
      new Float32Array(16000),
      new Float32Array(16000),
    ]);
    const loader = new AudioLoader(ctx);
    await loader.load("white");
    expect(fetch).not.toHaveBeenCalled();
    expect(createBuffer).toHaveBeenCalledWith(2, 16000, 8000);
    expect(generateNoiseChannels).toHaveBeenCalledWith(
      "white",
      8000,
      expect.any(AbortSignal),
    );
    loader.clear();
  });
});
