import { useSyncExternalStore } from "react";
import { getAudioEngine, type EngineSnapshot } from "./audioEngine";

const serverSnap: EngineSnapshot = {
  status: "idle",
  master: 80,
  channels: {},
  loading: [],
  errors: {},
  timerEndsAt: null,
};

export function useAudio() {
  const engine = getAudioEngine();
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot, () => serverSnap);
  return {
    engine,
    state,
    playing:
      state.status === "playing" || state.status === "loading" || state.status === "interrupted",
  };
}
