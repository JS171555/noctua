import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

interface LoaderRequest {
  id: string;
  resolve: (buffer: AudioBuffer) => void;
  reject: (reason?: unknown) => void;
}

interface LoaderLike {
  requests: LoaderRequest[];
}

const loaderInstances = vi.hoisted(() => [] as LoaderLike[]);

vi.mock("@/services/audio/loader", () => {
  class MockAudioLoader {
    requests: LoaderRequest[] = [];

    constructor() {
      loaderInstances.push(this);
    }

    load(id: string) {
      return new Promise<AudioBuffer>((resolve, reject) => {
        this.requests.push({ id, resolve, reject });
      });
    }

    clear() {}
  }

  return { AudioLoader: MockAudioLoader };
});

class MockParam {
  constructor(public value = 0) {}

  setValueAtTime(value: number) {
    this.value = value;
    return this;
  }

  linearRampToValueAtTime(value: number) {
    this.value = value;
    return this;
  }

  setTargetAtTime(value: number) {
    this.value = value;
    return this;
  }

  cancelScheduledValues() {
    return this;
  }
}

class MockNode {
  connections: unknown[] = [];
  disconnectCalls = 0;

  connect(destination: unknown) {
    this.connections.push(destination);
    return destination;
  }

  disconnect() {
    this.disconnectCalls += 1;
    this.connections = [];
  }
}

class MockGainNode extends MockNode {
  gain = new MockParam();
}

class MockFilterNode extends MockNode {
  type: BiquadFilterType = "lowpass";
  frequency = new MockParam();
  Q = new MockParam();
}

class MockCompressorNode extends MockNode {
  threshold = new MockParam();
  knee = new MockParam();
  ratio = new MockParam();
  attack = new MockParam();
  release = new MockParam();
}

class MockSourceNode extends MockNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  onended: ((this: AudioScheduledSourceNode, ev: Event) => unknown) | null =
    null;
  startCalls: Array<{ when: number; offset: number }> = [];
  stopCalls: number[] = [];

  start(when = 0, offset = 0) {
    this.startCalls.push({ when, offset });
  }

  stop(when = 0) {
    this.stopCalls.push(when);
    if (when > 0) return;
    this.fireEnded();
  }

  fireEnded() {
    this.onended?.call(
      this as unknown as AudioScheduledSourceNode,
      new Event("ended"),
    );
  }
}

const createdContexts: MockAudioContext[] = [];

class MockAudioContext {
  state: AudioContextState = "suspended";
  currentTime = 0;
  sampleRate = 48_000;
  destination = new MockNode();
  gains: MockGainNode[] = [];
  filters: MockFilterNode[] = [];
  compressors: MockCompressorNode[] = [];
  sources: MockSourceNode[] = [];
  resumeCalls = 0;
  suspendCalls = 0;
  resumeMode: "running" | "suspended" | "reject" = "running";
  private listeners = new Map<string, EventListener>();

  constructor() {
    createdContexts.push(this);
  }

  createGain() {
    const gain = new MockGainNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createBiquadFilter() {
    const filter = new MockFilterNode();
    this.filters.push(filter);
    return filter as unknown as BiquadFilterNode;
  }

  createDynamicsCompressor() {
    const compressor = new MockCompressorNode();
    this.compressors.push(compressor);
    return compressor as unknown as DynamicsCompressorNode;
  }

  createBufferSource() {
    const source = new MockSourceNode();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.set(type, listener as EventListener);
  }

  removeEventListener(type: string) {
    this.listeners.delete(type);
  }

  async resume() {
    this.resumeCalls += 1;
    if (this.resumeMode === "reject") throw new Error("resume denied");
    if (this.resumeMode === "running") this.state = "running";
  }

  async suspend() {
    this.suspendCalls += 1;
    this.state = "suspended";
  }

  async close() {
    this.state = "closed";
  }
}

Object.defineProperty(window, "AudioContext", {
  configurable: true,
  writable: true,
  value: MockAudioContext,
});

const makeBuffer = () => ({ duration: 8 }) as AudioBuffer;

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function requestFor(loader: LoaderLike, id: string, index = 0) {
  const matches = loader.requests.filter((request) => request.id === id);
  const request = matches[index];
  if (!request) throw new Error(`request not found: ${id}[${index}]`);
  return request;
}

describe("AudioEngine", () => {
  let engine: ReturnType<
    typeof import("@/services/audio/audioEngine").getAudioEngine
  >;

  beforeEach(async () => {
    vi.useRealTimers();
    engine = (await import("@/services/audio/audioEngine")).getAudioEngine();
    await engine.dispose();
    loaderInstances.length = 0;
    createdContexts.length = 0;
  });

  afterEach(async () => {
    await engine.dispose();
    vi.useRealTimers();
  });

  it("uses measured mix headroom, a 20Hz high-pass, and gentle bus compression", async () => {
    engine.addSound("rain", 100);
    engine.addSound("wind", 100);
    const play = engine.play();
    await flush();

    const loader = loaderInstances[0];
    if (!loader) throw new Error("loader was not created");
    requestFor(loader, "rain").resolve(makeBuffer());
    requestFor(loader, "wind").resolve(makeBuffer());
    await play;

    const ctx = createdContexts[0];
    if (!ctx) throw new Error("context was not created");
    expect(engine.getSnapshot().status).toBe("playing");
    expect(ctx.filters[0]?.type).toBe("highpass");
    expect(ctx.filters[0]?.frequency.value).toBe(20);
    expect(ctx.compressors[0]?.threshold.value).toBe(-18);
    expect(ctx.compressors[0]?.ratio.value).toBe(2);
    // 80% master gain is reduced by the RMS-like sum of two full-gain channels,
    // but remains comfortably above silence.
    expect(ctx.gains[0]?.gain.value).toBeGreaterThan(0.35);
    expect(ctx.gains[0]?.gain.value).toBeLessThan(0.64);
  });

  it("clamps non-finite and out-of-range channel/master volumes", () => {
    engine.addSound("rain", Number.NaN);
    engine.addSound("wind", Number.POSITIVE_INFINITY);
    engine.addSound("fire", -20);
    engine.setVolume("rain", 140);
    engine.setVolume("wind", Number.NEGATIVE_INFINITY);
    engine.setMaster(-5);

    expect(engine.getSnapshot().channels).toEqual({
      rain: 100,
      wind: 0,
      fire: 0,
    });
    expect(engine.getSnapshot().master).toBe(0);
  });

  it("coalesces concurrent starts for one channel into one pending load/source", async () => {
    engine.addSound("rain", 60);
    const firstPlay = engine.play();
    await flush();
    const loader = loaderInstances[0];
    if (!loader) throw new Error("loader was not created");

    const secondPlay = engine.play();
    await flush();
    expect(
      loader.requests.filter((request) => request.id === "rain"),
    ).toHaveLength(1);

    requestFor(loader, "rain").resolve(makeBuffer());
    await Promise.all([firstPlay, secondPlay]);
    expect(createdContexts[0]?.sources).toHaveLength(1);
  });

  it("does not leak errors from a removed/re-added channel's old load", async () => {
    engine.addSound("rain", 60);
    const play = engine.play();
    await flush();
    const loader = loaderInstances[0];
    if (!loader) throw new Error("loader was not created");
    expect(loader.requests).toHaveLength(1);

    engine.removeSound("rain");
    engine.addSound("rain", 70);
    await flush();
    expect(
      loader.requests.filter((request) => request.id === "rain"),
    ).toHaveLength(2);

    requestFor(loader, "rain", 0).reject(new Error("old request"));
    await flush();
    expect(engine.getSnapshot().errors).toEqual({});

    requestFor(loader, "rain", 1).reject(new Error("new request"));
    await flush();
    expect(engine.getSnapshot().errors).toEqual({ rain: "new request" });
    await play;
  });

  it("cancels a pause timeout on play and dispose, including before a new context", async () => {
    vi.useFakeTimers();
    engine.addSound("rain", 50);
    const play = engine.play();
    await flush();
    const loader = loaderInstances[0];
    if (!loader) throw new Error("loader was not created");
    requestFor(loader, "rain").resolve(makeBuffer());
    await play;

    const oldContext = createdContexts[0];
    if (!oldContext) throw new Error("context was not created");
    engine.pause(0.01);
    await engine.play();
    vi.advanceTimersByTime(1_000);
    expect(oldContext.suspendCalls).toBe(0);

    engine.pause(0.01);
    await engine.dispose();
    engine.addSound("wind", 50);
    const secondPlay = engine.play();
    await flush();
    const secondLoader = loaderInstances[1];
    if (!secondLoader) throw new Error("second loader was not created");
    requestFor(secondLoader, "wind").resolve(makeBuffer());
    await secondPlay;
    vi.advanceTimersByTime(1_000);
    expect(oldContext.suspendCalls).toBe(0);
    expect(createdContexts[1]?.suspendCalls).toBe(0);
  });

  it("ignores a loading resolution after dispose and disconnects the graph", async () => {
    engine.addSound("rain", 50);
    const play = engine.play();
    await flush();
    const loader = loaderInstances[0];
    const ctx = createdContexts[0];
    if (!loader || !ctx) throw new Error("audio was not created");

    await engine.dispose();
    requestFor(loader, "rain").resolve(makeBuffer());
    await play;
    await flush();

    expect(ctx.sources).toHaveLength(0);
    expect(engine.getSnapshot()).toMatchObject({
      status: "idle",
      loading: [],
      errors: {},
      channels: {},
    });
    expect(ctx.gains[0]?.disconnectCalls).toBeGreaterThan(0);
    expect(ctx.filters[0]?.disconnectCalls).toBeGreaterThan(0);
    expect(ctx.compressors[0]?.disconnectCalls).toBeGreaterThan(0);
  });

  it("reports the actual context state when resume resolves without running", async () => {
    const play = engine.play();
    await flush();
    const ctx = createdContexts[0];
    if (!ctx) throw new Error("context was not created");
    ctx.resumeMode = "suspended";
    ctx.state = "suspended";

    await engine.resume();
    expect(engine.getSnapshot().status).toBe("interrupted");
    ctx.resumeMode = "running";
    await engine.resume();
    expect(engine.getSnapshot().status).toBe("playing");
    await play;
  });

  it("recreates a closed context and restarts layers on resume", async () => {
    engine.addSound("rain", 60);
    const play = engine.play();
    await flush();
    const firstLoader = loaderInstances[0];
    const firstContext = createdContexts[0];
    if (!firstLoader || !firstContext) throw new Error("audio was not created");
    requestFor(firstLoader, "rain").resolve(makeBuffer());
    await play;

    const oldSource = firstContext.sources[0];
    if (!oldSource) throw new Error("source was not created");
    firstContext.state = "closed";

    const resume = engine.resume();
    await flush();
    const secondContext = createdContexts[1];
    const secondLoader = loaderInstances[1];
    if (!secondContext || !secondLoader)
      throw new Error("closed context was not recreated");
    expect(oldSource.disconnectCalls).toBeGreaterThan(0);
    expect(engine.getSnapshot().channels).toEqual({ rain: 60 });

    requestFor(secondLoader, "rain").resolve(makeBuffer());
    await resume;
    expect(secondContext.sources).toHaveLength(1);
    expect(engine.getSnapshot().status).toBe("playing");
  });

  it("keeps a removed fading voice in headroom until its ended callback", async () => {
    engine.addSound("rain", 100);
    engine.addSound("wind", 100);
    engine.setMaster(80);
    const play = engine.play();
    await flush();
    const loader = loaderInstances[0];
    const ctx = createdContexts[0];
    if (!loader || !ctx) throw new Error("audio was not created");
    requestFor(loader, "rain").resolve(makeBuffer());
    requestFor(loader, "wind").resolve(makeBuffer());
    await play;

    const removedSource = ctx.sources[0];
    const master = ctx.gains[0];
    if (!removedSource || !master) throw new Error("nodes were not created");
    engine.removeSound("rain");

    expect(master.gain.value).toBeCloseTo(0.64 * (0.92 / Math.sqrt(2)));
    removedSource.fireEnded();
    expect(master.gain.value).toBeCloseTo(0.64 * 0.92);
  });

  it("stops and disconnects a removed voice immediately when context is not running", async () => {
    engine.addSound("rain", 60);
    const play = engine.play();
    await flush();
    const loader = loaderInstances[0];
    const ctx = createdContexts[0];
    if (!loader || !ctx) throw new Error("audio was not created");
    requestFor(loader, "rain").resolve(makeBuffer());
    await play;

    const source = ctx.sources[0];
    if (!source) throw new Error("source was not created");
    ctx.state = "suspended";
    engine.removeSound("rain");

    expect(source.stopCalls[source.stopCalls.length - 1]).toBe(0);
    expect(source.disconnectCalls).toBeGreaterThan(0);
    expect(ctx.gains.slice(1).some((gain) => gain.disconnectCalls > 0)).toBe(
      true,
    );
  });
});
