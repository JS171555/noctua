/** Preset validation shared by the UI and the backend service. */
export interface PresetMixItem {
  soundId: string; // sound slug
  volume: number;
}

export function validatePreset(name: string, mix: PresetMixItem[]) {
  const clean = name.trim();
  if (!clean) throw new Error("Dê um nome à sua atmosfera");
  if (clean.length > 40) throw new Error("Use até 40 caracteres no nome");
  if (mix.length === 0) throw new Error("Adicione ao menos um som");
  return clean;
}
