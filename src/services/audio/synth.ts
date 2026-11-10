/**
 * Procedural demo sounds. Every sound is synthesized locally (no third-party
 * recordings), so there are no licensing issues. Replace any of them with a
 * real file by adding a URL in `src/config/audio-sources.ts`.
 */

export const LOOP_SECONDS = 12;
const FADE_SECONDS = 1;

type Gen = (n: number, sr: number) => Float32Array;

const rand = () => Math.random() * 2 - 1;

function white(n: number) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = rand();
  return a;
}

function pink(n: number) {
  const a = new Float32Array(n);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = rand();
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    a[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return a;
}

function brown(n: number) {
  const a = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    last = (last + 0.02 * rand()) / 1.02;
    a[i] = last * 3.5;
  }
  return a;
}

function lowpass(a: Float32Array, cutoff: number, sr: number) {
  const k = 1 - Math.exp((-2 * Math.PI * cutoff) / sr);
  let y = 0;
  for (let i = 0; i < a.length; i++) {
    y += k * (a[i]! - y);
    a[i] = y;
  }
  return a;
}

function highpass(a: Float32Array, cutoff: number, sr: number) {
  const k = 1 - Math.exp((-2 * Math.PI * cutoff) / sr);
  let y = 0;
  for (let i = 0; i < a.length; i++) {
    y += k * (a[i]! - y);
    a[i] = a[i]! - y;
  }
  return a;
}

/** Slowly varying random envelope between 0 and 1. */
function wander(n: number, sr: number, hz: number) {
  const a = lowpass(white(n), hz, sr);
  let max = 1e-6;
  for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(a[i]!));
  for (let i = 0; i < n; i++) a[i] = 0.5 + 0.5 * (a[i]! / max);
  return a;
}

function mix(...layers: [Float32Array, number][]) {
  const n = layers[0]![0].length;
  const out = new Float32Array(n);
  for (const [l, g] of layers) for (let i = 0; i < n; i++) out[i]! += l[i]! * g;
  return out;
}

function normalize(a: Float32Array, peak = 0.8) {
  let max = 1e-6;
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i]!));
  const g = peak / max;
  for (let i = 0; i < a.length; i++) a[i]! *= g;
  return a;
}

/** Scatter short decaying noise bursts (rain drops, crackles). */
function impulses(n: number, sr: number, perSecond: number, decayMs: number, hp: number) {
  const out = new Float32Array(n);
  const count = Math.floor((n / sr) * perSecond);
  const len = Math.floor((decayMs / 1000) * sr * 5);
  for (let c = 0; c < count; c++) {
    const start = Math.floor(Math.random() * n);
    const amp = Math.pow(Math.random(), 2);
    for (let j = 0; j < len && start + j < n; j++) {
      out[start + j]! += rand() * amp * Math.exp(-j / ((decayMs / 1000) * sr));
    }
  }
  return highpass(out, hp, sr);
}

function tone(
  out: Float32Array,
  sr: number,
  start: number,
  dur: number,
  f0: number,
  f1: number,
  amp: number,
) {
  const s = Math.floor(start * sr),
    len = Math.floor(dur * sr);
  let phase = 0;
  for (let j = 0; j < len && s + j < out.length; j++) {
    const t = j / len;
    phase += (2 * Math.PI * (f0 + (f1 - f0) * t)) / sr;
    out[s + j]! += Math.sin(phase) * amp * Math.sin(Math.PI * t);
  }
}

function birds(n: number, sr: number, rate = 1.2) {
  const out = new Float32Array(n);
  const secs = n / sr;
  for (let k = 0; k < secs * rate; k++) {
    const t0 = Math.random() * secs;
    const base = 2200 + Math.random() * 2000;
    const reps = 2 + Math.floor(Math.random() * 3);
    for (let r = 0; r < reps; r++) {
      tone(
        out,
        sr,
        t0 + r * 0.14,
        0.08 + Math.random() * 0.05,
        base,
        base + 1200 * (Math.random() - 0.3),
        0.3,
      );
    }
  }
  return out;
}

function rain(n: number, sr: number) {
  const bed = lowpass(highpass(pink(n), 400, sr), 6000, sr);
  return mix([bed, 1], [impulses(n, sr, 90, 2, 1500), 0.5]);
}

function thunderLayer(n: number, sr: number, cutoff: number) {
  const out = new Float32Array(n);
  const rumble = lowpass(brown(n), cutoff, sr);
  const secs = n / sr;
  const strikes = [secs * 0.15, secs * 0.6];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let env = 0.08;
    for (const s of strikes)
      if (t > s) env += Math.exp(-(t - s) / 2.5) * Math.min(1, (t - s) / 0.25);
    out[i] = rumble[i]! * env;
  }
  return out;
}

function wind(n: number, sr: number) {
  const env = wander(n, sr, 0.15);
  const w = lowpass(brown(n), 900, sr);
  for (let i = 0; i < n; i++) w[i]! *= 0.2 + env[i]!;
  return w;
}

function fire(n: number, sr: number, crackle: number) {
  const bed = lowpass(brown(n), 300, sr);
  return mix(
    [bed, 0.6],
    [impulses(n, sr, crackle, 1.2, 2000), 1.4],
    [impulses(n, sr, crackle / 6, 4, 600), 0.8],
  );
}

const generators: Record<string, Gen> = {
  white: (n) => white(n),
  pink: (n) => pink(n),
  brown: (n) => brown(n),
  rain,
  "window-rain": (n, sr) =>
    mix([lowpass(pink(n), 2500, sr), 0.5], [impulses(n, sr, 25, 3, 2500), 1.2]),
  "roof-rain": (n, sr) =>
    mix([lowpass(brown(n), 1500, sr), 0.8], [lowpass(impulses(n, sr, 140, 4, 200), 2500, sr), 1.2]),
  thunder: (n, sr) => thunderLayer(n, sr, 220),
  "far-storm": (n, sr) => mix([lowpass(rain(n, sr), 1800, sr), 0.7], [thunderLayer(n, sr, 110), 1]),
  wind,
  "tree-wind": (n, sr) => {
    const env = wander(n, sr, 0.3);
    const rustle = highpass(pink(n), 1800, sr);
    for (let i = 0; i < n; i++) rustle[i]! *= env[i]! * env[i]!;
    return mix([wind(n, sr), 1], [rustle, 0.6]);
  },
  ocean: (n, sr) => {
    const period = LOOP_SECONDS / 2;
    const body = lowpass(brown(n), 600, sr);
    const foam = highpass(pink(n), 1500, sr);
    for (let i = 0; i < n; i++) {
      const e = 0.2 + 0.8 * Math.pow(Math.sin((Math.PI * (i / sr)) / period), 2);
      body[i]! *= e;
      foam[i]! *= e * e;
    }
    return mix([body, 1], [foam, 0.35]);
  },
  forest: (n, sr) =>
    mix([lowpass(pink(n), 2500, sr), 0.25], [birds(n, sr, 0.6), 0.7], [wind(n, sr), 0.25]),
  birds: (n, sr) => mix([lowpass(pink(n), 2000, sr), 0.08], [birds(n, sr, 1.5), 1]),
  crickets: (n, sr) => {
    const out = new Float32Array(n);
    for (const [f, offset, gap] of [
      [4600, 0, 0.6],
      [4300, 0.27, 0.75],
    ] as const) {
      for (let t = offset; t < n / sr; t += gap)
        for (let p = 0; p < 3; p++) tone(out, sr, t + p * 0.035, 0.025, f, f, 0.3);
    }
    return mix([out, 1], [lowpass(pink(n), 1200, sr), 0.05]);
  },
  stream: (n, sr) => {
    const w = lowpass(highpass(white(n), 700, sr), 5000, sr);
    const env = wander(n, sr, 6);
    for (let i = 0; i < n; i++) w[i]! *= 0.4 + env[i]!;
    return w;
  },
  leaves: (n, sr) => {
    const r = highpass(pink(n), 1200, sr);
    const env = wander(n, sr, 0.5);
    for (let i = 0; i < n; i++) r[i]! *= Math.pow(env[i]!, 3);
    return r;
  },
  fireplace: (n, sr) => fire(n, sr, 10),
  campfire: (n, sr) => mix([fire(n, sr, 22), 1], [wind(n, sr), 0.3]),
  cafe: (n, sr) => {
    const voices = new Float32Array(n);
    for (let v = 0; v < 5; v++) {
      const m = lowpass(highpass(pink(n), 250, sr), 1600, sr);
      const env = wander(n, sr, 2.5);
      for (let i = 0; i < n; i++) voices[i]! += m[i]! * Math.pow(env[i]!, 2);
    }
    const clinks = new Float32Array(n);
    for (let k = 0; k < 6; k++)
      tone(clinks, sr, Math.random() * (n / sr), 0.15, 3800 + Math.random() * 1500, 3800, 0.15);
    return mix([voices, 1], [clinks, 1]);
  },
  train: (n, sr) => {
    const bed = lowpass(brown(n), 400, sr);
    const clack = new Float32Array(n);
    for (let t = 0; t < n / sr; t += 1.2) {
      tone(clack, sr, t, 0.12, 90, 60, 0.8);
      tone(clack, sr, t + 0.16, 0.12, 90, 60, 0.6);
    }
    return mix([bed, 0.8], [lowpass(impulses(n, sr, 3, 6, 100), 800, sr), 0.3], [clack, 1]);
  },
};

/** Crossfade the tail into the head so the buffer loops with no audible seam. */
export function makeSeamless(a: Float32Array, loopLength: number) {
  const fade = a.length - loopLength;
  const out = a.slice(0, loopLength);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    out[i] = a[i]! * Math.sqrt(t) + a[loopLength + i]! * Math.sqrt(1 - t);
  }
  return out;
}

export function hasSynth(id: string) {
  return id in generators;
}

export function synthesize(id: string, sampleRate: number): Float32Array {
  const gen = generators[id];
  if (!gen) throw new Error(`Som desconhecido: ${id}`);
  const loop = Math.floor(LOOP_SECONDS * sampleRate);
  const total = loop + Math.floor(FADE_SECONDS * sampleRate);
  return normalize(makeSeamless(gen(total, sampleRate), loop));
}
