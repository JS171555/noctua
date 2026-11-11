import { synthesizeStereo } from "./synth";

export async function generateNoiseChannels(
  id: string,
  sampleRate: number,
  signal: AbortSignal,
): Promise<Float32Array[]> {
  if (signal.aborted) throw new Error("Carregamento cancelado");
  if (typeof Worker === "undefined") {
    // Older environments still work; current Android/iOS use the worker branch.
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (signal.aborted) throw new Error("Carregamento cancelado");
    return synthesizeStereo(id, sampleRate);
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./noise.worker.ts", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new Error("Carregamento cancelado"));
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (
      event: MessageEvent<{ channels?: Float32Array[]; error?: string }>,
    ) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.channels?.length === 2) resolve(event.data.channels);
      else reject(new Error("Resposta de áudio inválida"));
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error("Não foi possível preparar o ruído"));
    };
    worker.postMessage({ id, sampleRate });
  });
}
