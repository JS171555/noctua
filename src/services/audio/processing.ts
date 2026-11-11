export const LOOP_CROSSFADE_SECONDS = 2;
export const TARGET_RMS = 0.08;
export const MAX_SAMPLE_PEAK = 0.55;

/** Blend an extra tail into the head without inserting silence at the seam. */
export function makeSeamless(
  input: Float32Array,
  loopLength: number,
): Float32Array {
  if (
    !Number.isInteger(loopLength) ||
    loopLength < 1 ||
    loopLength > input.length
  ) {
    throw new Error("Comprimento de loop inválido");
  }
  const fade = Math.min(input.length - loopLength, loopLength);
  const output = input.slice(0, loopLength);
  for (let i = 0; i < fade; i++) {
    const position = fade === 1 ? 0 : i / (fade - 1);
    const angle = (Math.PI / 2) * position;
    output[i] =
      input[loopLength + i]! * Math.cos(angle) + input[i]! * Math.sin(angle);
  }
  return output;
}

/** Shared gain preserves stereo imaging; peak cap leaves room for layering. */
export function prepareChannels(
  channels: Float32Array[],
  sampleRate: number,
  crossfadeSeconds = LOOP_CROSSFADE_SECONDS,
): Float32Array[] {
  if (!channels.length || !Number.isFinite(sampleRate) || sampleRate < 8000) {
    throw new Error("Formato de áudio inválido");
  }
  const length = channels[0]!.length;
  if (length < 2 || channels.some((channel) => channel.length !== length)) {
    throw new Error("Canais de áudio inválidos");
  }
  if (!Number.isFinite(crossfadeSeconds) || crossfadeSeconds < 0) {
    throw new Error("Crossfade inválido");
  }
  const fade = Math.min(
    Math.floor(sampleRate * crossfadeSeconds),
    Math.floor(length / 4),
  );
  const result = channels.map((channel) => {
    let mean = 0;
    for (const value of channel) {
      if (!Number.isFinite(value))
        throw new Error("Áudio contém amostras inválidas");
      mean += value;
    }
    mean /= length;
    const clean = new Float32Array(length);
    for (let i = 0; i < length; i++) clean[i] = channel[i]! - mean;
    return makeSeamless(clean, length - fade);
  });
  // The overlap can change the mean slightly. Remove the residual as well.
  let energy = 0;
  let peak = 0;
  for (const channel of result) {
    let mean = 0;
    for (const value of channel) mean += value;
    mean /= channel.length;
    for (let i = 0; i < channel.length; i++) {
      const value = channel[i]! - mean;
      channel[i] = value;
      energy += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
  }
  const rms = Math.sqrt(energy / (result.length * result[0]!.length));
  if (rms < 1e-7 || peak < 1e-7)
    throw new Error("O arquivo de áudio está silencioso");
  // Never amplify extremely quiet material more than 12 dB.
  const gain = Math.min(TARGET_RMS / rms, MAX_SAMPLE_PEAK / peak, 4);
  for (const channel of result) {
    for (let i = 0; i < channel.length; i++) channel[i]! *= gain;
  }
  return result;
}
