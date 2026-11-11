import { prepareChannels, LOOP_CROSSFADE_SECONDS } from "./processing";

export { makeSeamless } from "./processing";
export const LOOP_SECONDS = 24;
export type NoiseId = "white" | "pink" | "brown";

/** Independent seeded streams: reproducible QA without identical L/R channels. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 2147483648 - 1;
  };
}

export function hasSynth(id: string): id is NoiseId {
  return id === "white" || id === "pink" || id === "brown";
}

function noise(id: NoiseId, length: number, sampleRate: number, seed: number) {
  const output = new Float32Array(length);
  const rand = random(seed);
  const referenceRate = 44100;
  const poles = [0.99886, 0.99332, 0.969, 0.8665, 0.55, -0.7616].map(
    (pole) =>
      Math.sign(pole) * Math.pow(Math.abs(pole), referenceRate / sampleRate),
  );
  const coefficients = [
    0.0555179, 0.0750759, 0.153852, 0.3104856, 0.5329522, -0.016898,
  ];
  const state = new Float64Array(6);
  let previousPink = 0;
  let integrated = 0;
  let low = 0;
  // Brown noise: leaky integration avoids DC drift; 18 Hz HP removes rumble.
  const brownPole = Math.exp((-2 * Math.PI * 8) / sampleRate);
  const highpassPole = 1 - Math.exp((-2 * Math.PI * 18) / sampleRate);
  for (let i = 0; i < length; i++) {
    const white = rand();
    let value = white;
    if (id === "pink") {
      let sum = 0;
      for (let band = 0; band < state.length; band++) {
        state[band] = state[band]! * poles[band]! + white * coefficients[band]!;
        sum += state[band]!;
      }
      value = (sum + previousPink + white * 0.5362) * 0.11;
      previousPink = white * 0.115926;
    } else if (id === "brown") {
      integrated = integrated * brownPole + white * 0.02;
      value = integrated;
    }
    low += highpassPole * (value - low);
    output[i] = value - low;
  }
  return output;
}

/** Only the three mathematical noises are synthesized; ambience uses real assets. */
export function synthesizeStereo(
  id: string,
  sampleRate: number,
): Float32Array[] {
  if (!hasSynth(id)) throw new Error(`Som desconhecido: ${id}`);
  if (
    !Number.isFinite(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 192000
  ) {
    throw new Error("Taxa de amostragem inválida");
  }
  const total = Math.floor(
    (LOOP_SECONDS + LOOP_CROSSFADE_SECONDS) * sampleRate,
  );
  const seed = { white: 0x5d24ac91, pink: 0x32b195f7, brown: 0x714ce893 }[id];
  return prepareChannels(
    [
      noise(id, total, sampleRate, seed),
      noise(id, total, sampleRate, seed ^ 0x1a937b45),
    ],
    sampleRate,
  );
}

/** Compatibility entry for analysis/tests that need a single channel. */
export function synthesize(id: string, sampleRate: number): Float32Array {
  return synthesizeStereo(id, sampleRate)[0]!;
}
