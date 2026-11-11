#!/usr/bin/env node
/** Verify the exact app DSP on FFmpeg-decoded assets, not a listening test. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = readFileSync(`${root}/src/services/audio/processing.ts`, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { prepareChannels, MAX_SAMPLE_PEAK, TARGET_RMS } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const ids = [
  "rain",
  "window-rain",
  "roof-rain",
  "thunder",
  "far-storm",
  "wind",
  "ocean",
  "forest",
  "birds",
  "crickets",
  "stream",
  "leaves",
  "tree-wind",
  "fireplace",
  "campfire",
  "cafe",
  "train",
];
const rows = [];
for (const id of ids) {
  const raw = execFileSync(
    "ffmpeg",
    [
      "-nostdin",
      "-v",
      "error",
      "-i",
      `${root}/public/audio/v2/${id}.mp3`,
      "-ar",
      "44100",
      "-ac",
      "2",
      "-f",
      "f32le",
      "-acodec",
      "pcm_f32le",
      "pipe:1",
    ],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  const pcm = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const channels = [
    new Float32Array(pcm.length / 2),
    new Float32Array(pcm.length / 2),
  ];
  for (let i = 0; i < channels[0].length; i++) {
    channels[0][i] = pcm[2 * i];
    channels[1][i] = pcm[2 * i + 1];
  }
  const output = prepareChannels(channels, 44100);
  let energy = 0;
  let peak = 0;
  let maxDC = 0;
  for (const channel of output) {
    let sum = 0;
    for (const sample of channel) {
      assert(Number.isFinite(sample));
      energy += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
      sum += sample;
    }
    maxDC = Math.max(maxDC, Math.abs(sum / channel.length));
  }
  const rms = Math.sqrt(energy / (output.length * output[0].length));
  assert(rms > 0.01 && rms <= TARGET_RMS + 1e-6, `${id}: RMS out of range`);
  assert(peak <= MAX_SAMPLE_PEAK + 1e-6, `${id}: exceeds peak cap`);
  assert(maxDC < 1e-6, `${id}: residual DC`);
  const row = {
    id,
    processed_seconds: output[0].length / 44100,
    rms_dbfs: Number((20 * Math.log10(rms)).toFixed(2)),
    sample_peak_dbfs: Number((20 * Math.log10(peak)).toFixed(2)),
    max_dc_mean: maxDC,
    valid: true,
  };
  rows.push(row);
  console.log(
    `${id}: ${row.processed_seconds.toFixed(3)}s, ${row.rms_dbfs}dBFS RMS, pico ${row.sample_peak_dbfs}dBFS`,
  );
}
writeFileSync(
  `${root}/docs/audio-runtime-quality.json`,
  JSON.stringify(
    {
      method:
        "App prepareChannels applied to FFmpeg-decoded 44.1kHz stereo assets; not browser or human listening certification",
      validated_files: rows.length,
      files: rows,
    },
    null,
    2,
  ) + "\n",
);
