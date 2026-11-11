import { synthesizeStereo } from "./synth";

self.onmessage = (event: MessageEvent<{ id: string; sampleRate: number }>) => {
  try {
    const channels = synthesizeStereo(event.data.id, event.data.sampleRate);
    self.postMessage(
      { channels },
      { transfer: channels.map((channel) => channel.buffer) },
    );
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Falha ao gerar ruído",
    });
  }
};
