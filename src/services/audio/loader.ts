import { audioSources } from "@/config/audio-sources";
import { generateNoiseChannels } from "./noise-client";
import { prepareChannels } from "./processing";
import { hasSynth } from "./synth";

export const AUDIO_CACHE_BYTES = 96 * 1024 * 1024;
export const AUDIO_LOAD_CONCURRENCY = 2;
const LOAD_TIMEOUT_MS = 30_000;

type Task = { run: () => void; reject: (error: Error) => void };

/** Assets are fetched only on demand. Decoded data is shared and bounded (LRU). */
export class AudioLoader {
  private cache = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer>>();
  private cachedBytes = 0;
  private running = 0;
  private queue: Task[] = [];
  private controllers = new Set<AbortController>();
  private generation = 0;

  constructor(private ctx: BaseAudioContext) {}

  load(id: string): Promise<AudioBuffer> {
    const cached = this.cache.get(id);
    if (cached) {
      this.cache.delete(id);
      this.cache.set(id, cached);
      return Promise.resolve(cached);
    }
    const pending = this.pending.get(id);
    if (pending) return pending;
    if (!audioSources[id] && !hasSynth(id)) {
      return Promise.reject(new Error(`Som desconhecido: ${id}`));
    }
    const generation = this.generation;
    const task = new Promise<AudioBuffer>((resolve, reject) => {
      this.queue.push({
        reject,
        run: () => {
          this.running++;
          const controller = new AbortController();
          this.controllers.add(controller);
          const timeout = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
          void this.fetchOrSynth(id, controller.signal)
            .then((buffer) => {
              if (generation !== this.generation || controller.signal.aborted) {
                throw new Error("Carregamento cancelado");
              }
              this.remember(id, buffer);
              resolve(buffer);
            })
            .catch(reject)
            .finally(() => {
              clearTimeout(timeout);
              this.controllers.delete(controller);
              this.running--;
              this.drain();
            });
        },
      });
    });
    const result = task.finally(() => {
      // A teardown can replace this id with a newer request.
      if (this.pending.get(id) === result) this.pending.delete(id);
    });
    this.pending.set(id, result);
    this.drain();
    return result;
  }

  private drain() {
    while (this.running < AUDIO_LOAD_CONCURRENCY && this.queue.length)
      this.queue.shift()!.run();
  }

  private remember(id: string, buffer: AudioBuffer) {
    const bytes =
      buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
    if (bytes > AUDIO_CACHE_BYTES) return;
    while (this.cachedBytes + bytes > AUDIO_CACHE_BYTES && this.cache.size) {
      const oldest = this.cache.keys().next().value!;
      const removed = this.cache.get(oldest)!;
      this.cachedBytes -=
        removed.length *
        removed.numberOfChannels *
        Float32Array.BYTES_PER_ELEMENT;
      this.cache.delete(oldest);
    }
    this.cache.set(id, buffer);
    this.cachedBytes += bytes;
  }

  private async fetchOrSynth(
    id: string,
    signal: AbortSignal,
  ): Promise<AudioBuffer> {
    const url = audioSources[id];
    let channels: Float32Array[];
    let sampleRate = this.ctx.sampleRate;
    if (url) {
      const response = await fetch(url, { signal });
      if (!response.ok)
        throw new Error(`Falha ao carregar ${id} (${response.status})`);
      const decoded = await this.ctx.decodeAudioData(
        await response.arrayBuffer(),
      );
      if (signal.aborted) throw new Error("Carregamento cancelado");
      sampleRate = decoded.sampleRate;
      channels = prepareChannels(
        Array.from(
          { length: Math.min(decoded.numberOfChannels, 2) },
          (_, channel) => decoded.getChannelData(channel),
        ),
        sampleRate,
      );
    } else {
      channels = await generateNoiseChannels(id, sampleRate, signal);
    }
    if (signal.aborted) throw new Error("Carregamento cancelado");
    const buffer = this.ctx.createBuffer(
      channels.length,
      channels[0]!.length,
      sampleRate,
    );
    channels.forEach((channel, index) =>
      buffer.copyToChannel(channel as Float32Array<ArrayBuffer>, index),
    );
    return buffer;
  }

  clear() {
    this.generation++;
    for (const controller of this.controllers) controller.abort();
    for (const task of this.queue)
      task.reject(new Error("Carregamento cancelado"));
    this.queue = [];
    this.cache.clear();
    this.pending.clear();
    this.cachedBytes = 0;
  }
}
