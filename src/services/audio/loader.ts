import { audioSources } from "@/config/audio-sources";
import { synthesize } from "./synth";

/** Loads (or synthesizes) AudioBuffers and caches them per AudioContext. */
export class AudioLoader {
  private cache = new Map<string, Promise<AudioBuffer>>();
  constructor(private ctx: BaseAudioContext) {}

  load(id: string): Promise<AudioBuffer> {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const p = this.fetchOrSynth(id).catch((err) => {
      this.cache.delete(id); // allow retry
      throw err;
    });
    this.cache.set(id, p);
    return p;
  }

  private async fetchOrSynth(id: string): Promise<AudioBuffer> {
    const url = audioSources[id];
    if (url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Falha ao carregar ${id} (${res.status})`);
      return this.ctx.decodeAudioData(await res.arrayBuffer());
    }
    // Yield so the UI can show the loading state before CPU work.
    await new Promise((r) => setTimeout(r, 0));
    const data = synthesize(id, this.ctx.sampleRate);
    const buf = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
    buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
    return buf;
  }

  clear() {
    this.cache.clear();
  }
}
