import { AudioLoader } from "./loader";
import { SleepTimer } from "./sleep-timer";

/**
 * Graph: [BufferSource -> GainNode] per sound -> Master Gain -> 20Hz high-pass
 * -> gentle bus compressor -> destination.
 * The engine owns playback state; React reads it through `subscribe/getSnapshot`.
 */

export type EngineStatus =
  "idle" | "loading" | "playing" | "paused" | "interrupted";

export interface EngineSnapshot {
  status: EngineStatus;
  master: number; // 0..100
  channels: Record<string, number>; // id -> 0..100
  loading: string[];
  errors: Record<string, string>;
  timerEndsAt: number | null;
}

interface Channel {
  volume: number;
  gain: GainNode | null;
  source: AudioBufferSourceNode | null;
}

interface PendingChannel {
  id: string;
  channel: Channel;
  ctx: AudioContext;
  loader: AudioLoader;
  master: GainNode;
  version: number;
  task: Promise<void>;
}

interface FadingVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  nominalGain: number;
}

const FADE_IN = 1.2;
const FADE_OUT = 1.2;
const TIMER_FADE = 12;
const MIX_HEADROOM_TARGET = 0.92;
const RUMBLE_CUTOFF_HZ = 20;

const clampVolume = (v: number) =>
  Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
const toGain = (v: number) => {
  const normalized = clampVolume(v) / 100;
  return normalized * normalized; // perceptual curve
};

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rumbleFilter: BiquadFilterNode | null = null;
  private busCompressor: DynamicsCompressorNode | null = null;
  private loader: AudioLoader | null = null;
  private channels = new Map<string, Channel>();
  private fadingVoices = new Set<FadingVoice>();
  private listeners = new Set<() => void>();
  private timer = new SleepTimer();
  private stopHandle: ReturnType<typeof setTimeout> | null = null;
  private wantPlaying = false;
  private contextVersion = 0;
  private pending = new Map<string, PendingChannel>();
  private snap: EngineSnapshot = {
    status: "idle",
    master: 80,
    channels: {},
    loading: [],
    errors: {},
    timerEndsAt: null,
  };
  private loading = new Set<string>();
  private errors: Record<string, string> = {};

  // ---------- events ----------
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;

  private emit(status?: EngineStatus) {
    this.snap = {
      status: status ?? this.snap.status,
      master: this.snap.master,
      channels: Object.fromEntries(
        [...this.channels].map(([id, c]) => [id, c.volume]),
      ),
      loading: [...this.loading],
      errors: { ...this.errors },
      timerEndsAt: this.timer.endsAt,
    };
    this.listeners.forEach((l) => l());
  }

  // ---------- context lifecycle ----------
  /** Must be called from a user gesture (browser autoplay policy). */
  private ensureContext(): AudioContext {
    if (this.ctx?.state === "closed") this.discardClosedContext();
    if (this.ctx && this.ctx.state !== "closed") return this.ctx;

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctor({ latencyHint: "playback" });
    const master = ctx.createGain();
    master.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = RUMBLE_CUTOFF_HZ;
    filter.Q.value = 0.707;

    const compressor = ctx.createDynamicsCompressor();
    // Gentle bus control: this is not intended to be a brickwall limiter.
    compressor.threshold.value = -18;
    compressor.knee.value = 24;
    compressor.ratio.value = 2;
    compressor.attack.value = 0.02;
    compressor.release.value = 0.25;

    master.connect(filter);
    filter.connect(compressor);
    compressor.connect(ctx.destination);

    this.contextVersion += 1;
    this.ctx = ctx;
    this.masterGain = master;
    this.rumbleFilter = filter;
    this.busCompressor = compressor;
    this.loader = new AudioLoader(ctx);
    ctx.addEventListener("statechange", this.onStateChange);
    document.addEventListener("visibilitychange", this.onVisible);
    return ctx;
  }

  private teardownContext() {
    const ctx = this.ctx;
    this.contextVersion += 1;
    this.loader?.clear();
    this.pending.clear();
    this.loading.clear();

    for (const channel of this.channels.values()) this.stopChannel(channel);
    for (const fade of [...this.fadingVoices])
      this.disconnectFadingVoice(fade, true, false);

    if (ctx) {
      ctx.removeEventListener("statechange", this.onStateChange);
      document.removeEventListener("visibilitychange", this.onVisible);
    }
    this.disconnectGraph();
    this.ctx = null;
    this.masterGain = null;
    this.rumbleFilter = null;
    this.busCompressor = null;
    this.loader = null;
    return ctx;
  }

  private discardClosedContext() {
    this.teardownContext();
  }

  private onStateChange = () => {
    if (!this.ctx) return;
    const s = this.ctx.state as AudioContextState | "interrupted";
    if (this.wantPlaying && s !== "running") this.emit("interrupted");
    else if (
      this.wantPlaying &&
      s === "running" &&
      this.snap.status === "interrupted"
    )
      this.emit("playing");
  };

  private onVisible = () => {
    if (document.visibilityState === "visible" && this.wantPlaying)
      void this.resume();
  };

  /** Try to recover a suspended/interrupted context (e.g. after a phone call). */
  async resume() {
    let ctx = this.ctx;
    if (ctx?.state === "closed") {
      this.discardClosedContext();
      if (!this.wantPlaying) return;
      ctx = this.ensureContext();
    }
    if (!ctx) return;
    try {
      await ctx.resume();
      // Some browsers resolve resume() while remaining suspended. Report the
      // state we actually have instead of claiming playback succeeded.
      if (this.ctx !== ctx || !this.wantPlaying) return;
      if (ctx.state === "running") {
        this.rampMaster(this.snap.master, FADE_IN);
        this.emit(this.channels.size ? "loading" : "playing");
        await Promise.all(
          [...this.channels.keys()].map((id) => this.startChannel(id)),
        );
      }
      if (this.ctx === ctx && this.wantPlaying)
        this.emit(ctx.state === "running" ? "playing" : "interrupted");
    } catch {
      if (this.ctx === ctx && this.wantPlaying) this.emit("interrupted");
    }
  }

  // ---------- playback ----------
  async play() {
    this.cancelPauseTimeout();
    const ctx = this.ensureContext();
    this.wantPlaying = true;

    if (ctx.state !== "running") await ctx.resume().catch(() => undefined);
    if (!this.wantPlaying || this.ctx !== ctx) return;

    const running = ctx.state === "running";
    this.emit(
      this.channels.size
        ? running
          ? "loading"
          : "interrupted"
        : running
          ? "playing"
          : "interrupted",
    );
    this.rampMaster(this.snap.master, FADE_IN);

    await Promise.all(
      [...this.channels.keys()].map((id) => this.startChannel(id)),
    );
    if (this.wantPlaying && this.ctx === ctx)
      this.emit(ctx.state === "running" ? "playing" : "interrupted");
  }

  pause(fade = FADE_OUT) {
    const ctx = this.ctx;
    if (!ctx || !this.wantPlaying) return;
    this.wantPlaying = false;
    this.timer.cancel();
    this.rampMaster(0, fade);
    this.emit("paused");

    const handle = setTimeout(
      () => {
        if (this.stopHandle !== handle) return;
        this.stopHandle = null;
        if (this.ctx !== ctx || this.wantPlaying) return;
        for (const id of this.channels.keys()) this.stopSource(id);
        void ctx.suspend().catch(() => undefined);
      },
      fade * 1000 + 100,
    );
    this.stopHandle = handle;
  }

  toggle() {
    return this.wantPlaying ? this.pause() : this.play();
  }

  get isPlaying() {
    return this.wantPlaying;
  }

  // ---------- channels ----------
  toggleSound(id: string) {
    if (this.channels.has(id)) this.removeSound(id);
    else this.addSound(id, 50);
  }

  addSound(id: string, volume: number) {
    if (this.channels.has(id)) return this.setVolume(id, volume);
    this.channels.set(id, {
      volume: clampVolume(volume),
      gain: null,
      source: null,
    });
    delete this.errors[id];
    this.emit();
    if (this.wantPlaying) {
      this.updateHeadroom();
      void this.startChannel(id);
    }
  }

  removeSound(id: string) {
    const ch = this.channels.get(id);
    if (!ch) return;
    this.cancelPending(id);
    this.channels.delete(id);
    delete this.errors[id];
    this.fadeOutAndDispose(ch);
    this.updateHeadroom();
    this.emit();
  }

  setVolume(id: string, volume: number) {
    const ch = this.channels.get(id);
    if (!ch) return;
    ch.volume = clampVolume(volume);
    if (ch.gain && this.ctx)
      ch.gain.gain.setTargetAtTime(
        toGain(ch.volume),
        this.ctx.currentTime,
        0.05,
      );
    this.updateHeadroom();
    this.emit();
  }

  setMaster(volume: number) {
    this.snap = { ...this.snap, master: clampVolume(volume) };
    if (this.wantPlaying) this.rampMaster(this.snap.master, 0.1);
    this.emit();
  }

  clear() {
    for (const id of [...this.channels.keys()]) this.removeSound(id);
    this.timer.cancel();
    this.emit(this.wantPlaying ? "playing" : "idle");
  }

  /** Replace the current mix, keeping playback going if already playing. */
  async loadMix(
    mix: { soundId: string; volume: number }[],
    opts: { autoplay?: boolean; master?: number } = {},
  ) {
    const next = new Set(mix.map((m) => m.soundId));
    for (const id of [...this.channels.keys()])
      if (!next.has(id)) this.removeSound(id);
    for (const m of mix) this.addSound(m.soundId, m.volume);
    if (opts.master !== undefined) this.setMaster(opts.master);
    if (opts.autoplay && !this.wantPlaying) await this.play();
  }

  retry(id: string) {
    if (!this.channels.has(id)) return;
    delete this.errors[id];
    this.emit();
    if (this.wantPlaying) void this.startChannel(id);
  }

  private startChannel(id: string): Promise<void> {
    const existing = this.pending.get(id);
    if (existing) return existing.task;

    const ctx = this.ctx;
    const loader = this.loader;
    const master = this.masterGain;
    const ch = this.channels.get(id);
    if (!ctx || !loader || !master || !ch || ch.source)
      return Promise.resolve();

    const operation: PendingChannel = {
      id,
      channel: ch,
      ctx,
      loader,
      master,
      version: this.contextVersion,
      task: Promise.resolve(),
    };
    this.pending.set(id, operation);
    this.loading.add(id);
    this.emit();
    operation.task = this.loadAndStartChannel(operation);
    return operation.task;
  }

  private async loadAndStartChannel(operation: PendingChannel) {
    let gain: GainNode | null = null;
    let source: AudioBufferSourceNode | null = null;
    try {
      const buffer = await operation.loader.load(operation.id);
      // State may have changed while loading. In particular, never connect a
      // buffer that resolved for a disposed context or a removed/replaced channel.
      if (!this.owns(operation) || !this.wantPlaying) return;

      gain = operation.ctx.createGain();
      gain.gain.setValueAtTime(0, operation.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(
        toGain(operation.channel.volume),
        operation.ctx.currentTime + FADE_IN,
      );
      gain.connect(operation.master);

      source = operation.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      // Random offset so layered loops do not line up identically each time.
      source.start(0, Math.random() * buffer.duration);

      operation.channel.gain = gain;
      operation.channel.source = source;
      gain = null;
      source = null;
    } catch (e) {
      this.disconnectNode(source);
      this.disconnectNode(gain);
      if (this.owns(operation))
        this.errors[operation.id] =
          e instanceof Error ? e.message : "Erro ao carregar o som";
    } finally {
      if (this.pending.get(operation.id) === operation) {
        this.pending.delete(operation.id);
        this.loading.delete(operation.id);
        this.emit();
      }
    }
  }

  private owns(operation: PendingChannel) {
    return (
      this.pending.get(operation.id) === operation &&
      this.contextVersion === operation.version &&
      this.ctx === operation.ctx &&
      this.loader === operation.loader &&
      this.masterGain === operation.master &&
      this.channels.get(operation.id) === operation.channel
    );
  }

  private cancelPending(id: string) {
    const operation = this.pending.get(id);
    if (!operation) return;
    this.pending.delete(id);
    this.loading.delete(id);
  }

  private stopSource(id: string) {
    const ch = this.channels.get(id);
    if (!ch) return;
    this.stopChannel(ch);
  }

  private stopChannel(ch: Channel) {
    const source = ch.source;
    const gain = ch.gain;
    ch.source = null;
    ch.gain = null;
    if (source) this.stopAndDisconnectVoice(source, gain);
    else this.disconnectNode(gain);
  }

  private stopAndDisconnectVoice(
    source: AudioBufferSourceNode,
    gain: GainNode | null,
  ) {
    source.onended = null;
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
    this.disconnectNode(source);
    this.disconnectNode(gain);
  }

  private fadeOutAndDispose(ch: Channel) {
    const source = ch.source;
    const gain = ch.gain;
    ch.source = null;
    ch.gain = null;
    if (!source) return;
    const ctx = this.ctx;
    if (!gain || !ctx || ctx.state !== "running") {
      this.stopAndDisconnectVoice(source, gain);
      return;
    }

    const fade: FadingVoice = { source, gain, nominalGain: toGain(ch.volume) };
    this.fadingVoices.add(fade);
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_OUT);

    const cleanup = () => this.disconnectFadingVoice(fade);
    source.onended = cleanup;
    try {
      source.stop(ctx.currentTime + FADE_OUT + 0.05);
    } catch {
      cleanup();
    }
  }

  private disconnectFadingVoice(
    fade: FadingVoice,
    stop = false,
    recompute = true,
  ) {
    if (!this.fadingVoices.delete(fade)) return;
    if (stop) this.stopAndDisconnectVoice(fade.source, fade.gain);
    else {
      fade.source.onended = null;
      this.disconnectNode(fade.source);
      this.disconnectNode(fade.gain);
    }
    if (recompute) this.updateHeadroom();
  }

  private rampMaster(volume: number, seconds: number) {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain) return;
    const g = masterGain.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(
      toGain(volume) * this.mixHeadroom(),
      ctx.currentTime + Math.max(0, seconds),
    );
  }

  private mixHeadroom() {
    const summedSquaredGains =
      [...this.channels.values()].reduce(
        (sum, channel) => sum + toGain(channel.volume) ** 2,
        0,
      ) +
      [...this.fadingVoices].reduce(
        (sum, fade) => sum + fade.nominalGain ** 2,
        0,
      );
    if (summedSquaredGains <= 0) return 1;
    return Math.min(1, MIX_HEADROOM_TARGET / Math.sqrt(summedSquaredGains));
  }

  private updateHeadroom() {
    if (this.wantPlaying) this.rampMaster(this.snap.master, 0.15);
  }

  private disconnectNode(node: AudioNode | null) {
    try {
      node?.disconnect();
    } catch {
      /* already disconnected */
    }
  }

  private disconnectGraph() {
    this.disconnectNode(this.masterGain);
    this.disconnectNode(this.rumbleFilter);
    this.disconnectNode(this.busCompressor);
  }

  private cancelPauseTimeout() {
    if (this.stopHandle !== null) clearTimeout(this.stopHandle);
    this.stopHandle = null;
  }

  // ---------- timer ----------
  setTimer(minutes: number | null) {
    if (!minutes) this.timer.cancel();
    else this.timer.start(minutes, () => this.pause(TIMER_FADE));
    this.emit();
  }

  /** Release everything (used on app teardown). */
  async dispose() {
    this.timer.cancel();
    this.cancelPauseTimeout();
    this.wantPlaying = false;
    const ctx = this.teardownContext();
    this.channels.clear();
    try {
      await ctx?.close();
    } catch {
      /* context may already be closed */
    }

    this.ctx = null;
    this.masterGain = null;
    this.rumbleFilter = null;
    this.busCompressor = null;
    this.loader = null;
    this.errors = {};
    this.emit("idle");
  }
}

let instance: AudioEngine | null = null;
export function getAudioEngine() {
  if (!instance) instance = new AudioEngine();
  return instance;
}
export type { AudioEngine };
