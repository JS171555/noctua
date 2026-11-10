import { AudioLoader } from "./loader";
import { SleepTimer } from "./sleep-timer";

/**
 * Graph: [BufferSource -> GainNode] per sound -> Master Gain -> destination.
 * The engine owns playback state; React reads it through `subscribe/getSnapshot`.
 */

export type EngineStatus = "idle" | "loading" | "playing" | "paused" | "interrupted";

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

const FADE_IN = 1.2;
const FADE_OUT = 1.2;
const TIMER_FADE = 12;

const toGain = (v: number) => Math.pow(v / 100, 2); // perceptual curve

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private loader: AudioLoader | null = null;
  private channels = new Map<string, Channel>();
  private listeners = new Set<() => void>();
  private timer = new SleepTimer();
  private stopHandle: ReturnType<typeof setTimeout> | null = null;
  private wantPlaying = false;
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
      channels: Object.fromEntries([...this.channels].map(([id, c]) => [id, c.volume])),
      loading: [...this.loading],
      errors: { ...this.errors },
      timerEndsAt: this.timer.endsAt,
    };
    this.listeners.forEach((l) => l());
  }

  // ---------- context lifecycle ----------
  /** Must be called from a user gesture (browser autoplay policy). */
  private ensureContext(): AudioContext {
    if (this.ctx && this.ctx.state !== "closed") return this.ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: "playback" });
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.masterGain = master;
    this.loader = new AudioLoader(ctx);
    ctx.addEventListener("statechange", this.onStateChange);
    document.addEventListener("visibilitychange", this.onVisible);
    return ctx;
  }

  private onStateChange = () => {
    if (!this.ctx) return;
    const s = this.ctx.state as AudioContextState | "interrupted";
    if (this.wantPlaying && s !== "running") this.emit("interrupted");
    else if (this.wantPlaying && s === "running" && this.snap.status === "interrupted")
      this.emit("playing");
  };

  private onVisible = () => {
    if (document.visibilityState === "visible" && this.wantPlaying) void this.resume();
  };

  /** Try to recover a suspended/interrupted context (e.g. after a phone call). */
  async resume() {
    if (!this.ctx) return;
    try {
      await this.ctx.resume();
      if (this.wantPlaying) this.emit("playing");
    } catch {
      this.emit("interrupted");
    }
  }

  // ---------- playback ----------
  async play() {
    const ctx = this.ensureContext();
    if (this.stopHandle) {
      clearTimeout(this.stopHandle);
      this.stopHandle = null;
    }
    this.wantPlaying = true;
    if (ctx.state !== "running") await ctx.resume().catch(() => undefined);
    this.emit(this.channels.size ? "loading" : "playing");
    this.rampMaster(this.snap.master, FADE_IN);
    await Promise.all([...this.channels.keys()].map((id) => this.startChannel(id)));
    if (this.wantPlaying) this.emit(ctx.state === "running" ? "playing" : "interrupted");
  }

  pause(fade = FADE_OUT) {
    if (!this.ctx || !this.wantPlaying) return;
    this.wantPlaying = false;
    this.timer.cancel();
    this.rampMaster(0, fade);
    this.emit("paused");
    this.stopHandle = setTimeout(
      () => {
        this.stopHandle = null;
        for (const id of this.channels.keys()) this.stopSource(id);
        void this.ctx?.suspend();
      },
      fade * 1000 + 100,
    );
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
    this.channels.set(id, { volume, gain: null, source: null });
    delete this.errors[id];
    this.emit();
    if (this.wantPlaying) void this.startChannel(id);
  }

  removeSound(id: string) {
    const ch = this.channels.get(id);
    if (!ch) return;
    this.channels.delete(id);
    delete this.errors[id];
    this.fadeOutAndDispose(ch);
    this.emit();
  }

  setVolume(id: string, volume: number) {
    const ch = this.channels.get(id);
    if (!ch) return;
    ch.volume = volume;
    if (ch.gain && this.ctx)
      ch.gain.gain.setTargetAtTime(toGain(volume), this.ctx.currentTime, 0.05);
    this.emit();
  }

  setMaster(volume: number) {
    this.snap = { ...this.snap, master: volume };
    if (this.wantPlaying) this.rampMaster(volume, 0.1);
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
    for (const id of [...this.channels.keys()]) if (!next.has(id)) this.removeSound(id);
    for (const m of mix) this.addSound(m.soundId, m.volume);
    if (opts.master !== undefined) this.setMaster(opts.master);
    if (opts.autoplay && !this.wantPlaying) await this.play();
  }

  retry(id: string) {
    delete this.errors[id];
    this.emit();
    if (this.wantPlaying) void this.startChannel(id);
  }

  private async startChannel(id: string) {
    const ctx = this.ctx,
      loader = this.loader,
      master = this.masterGain;
    const ch = this.channels.get(id);
    if (!ctx || !loader || !master || !ch || ch.source) return; // no duplicate sources
    this.loading.add(id);
    this.emit();
    try {
      const buffer = await loader.load(id);
      // State may have changed while loading.
      if (!this.wantPlaying || this.channels.get(id) !== ch || ch.source) return;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(toGain(ch.volume), ctx.currentTime + FADE_IN);
      gain.connect(master);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(gain);
      // Random offset so layered loops don't line up identically each time.
      src.start(0, Math.random() * buffer.duration);
      ch.gain = gain;
      ch.source = src;
    } catch (e) {
      this.errors[id] = e instanceof Error ? e.message : "Erro ao carregar o som";
    } finally {
      this.loading.delete(id);
      this.emit();
    }
  }

  private stopSource(id: string) {
    const ch = this.channels.get(id);
    if (!ch?.source) return;
    try {
      ch.source.stop();
    } catch {
      /* already stopped */
    }
    ch.source.disconnect();
    ch.gain?.disconnect();
    ch.source = null;
    ch.gain = null;
  }

  private fadeOutAndDispose(ch: Channel) {
    const { ctx } = this;
    if (!ctx || !ch.source || !ch.gain) return;
    const { source, gain } = ch;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_OUT);
    source.stop(ctx.currentTime + FADE_OUT + 0.05);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  }

  private rampMaster(volume: number, seconds: number) {
    const { ctx, masterGain } = this;
    if (!ctx || !masterGain) return;
    const g = masterGain.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(toGain(volume), ctx.currentTime + seconds);
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
    for (const id of this.channels.keys()) this.stopSource(id);
    this.channels.clear();
    document.removeEventListener("visibilitychange", this.onVisible);
    this.ctx?.removeEventListener("statechange", this.onStateChange);
    this.loader?.clear();
    await this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.masterGain = null;
    this.loader = null;
    this.wantPlaying = false;
    this.emit("idle");
  }
}

let instance: AudioEngine | null = null;
export function getAudioEngine() {
  if (!instance) instance = new AudioEngine();
  return instance;
}
export type { AudioEngine };
