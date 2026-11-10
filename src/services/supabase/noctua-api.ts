import { queryOptions } from "@tanstack/react-query";
import { isSupabaseConfigured, supabase } from "@/integration/supabase/client";
import { sounds as localSounds } from "@/data/sounds";
import { validatePreset, type PresetMixItem } from "@/services/audio/presets";

export interface CatalogSound {
  id: string;
  slug: string;
  name: string;
  category: string;
  position: number;
}

export interface SavedPreset {
  id: string;
  name: string;
  master: number;
  createdAt: string;
  mix: PresetMixItem[];
}

export interface Favorite {
  id: string;
  sound_id: string | null;
  preset_id: string | null;
}

/** Human message for any backend/network failure. */
export function errorMessage(e: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "Sem conexão com a internet.";
  if (e instanceof TypeError) return "Falha de conexão. Tente novamente.";
  if (e && typeof e === "object" && "message" in e)
    return String((e as { message: string }).message);
  return "Algo deu errado.";
}

export const soundsQuery = queryOptions({
  queryKey: ["sounds"],
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<CatalogSound[]> => {
    if (!isSupabaseConfigured) {
      return localSounds.map((sound, position) => ({
        id: sound.id,
        slug: sound.id,
        name: sound.name,
        category: sound.category,
        position,
      }));
    }
    const { data, error } = await supabase
      .from("sounds")
      .select("id, slug, name, category, position")
      .eq("is_active", true)
      .order("category")
      .order("position");
    if (error) throw error;
    return data;
  },
});

export const presetsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["presets", userId],
    queryFn: async (): Promise<SavedPreset[]> => {
      const { data, error } = await supabase
        .from("presets")
        .select(
          "id, name, master_volume, created_at, preset_sounds(volume, position, sounds(slug))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((p) => ({
        id: p.id,
        name: p.name,
        master: p.master_volume,
        createdAt: p.created_at,
        mix: [...p.preset_sounds]
          .sort((a, b) => a.position - b.position)
          .map((s) => ({ soundId: s.sounds?.slug ?? "", volume: s.volume }))
          .filter((m) => m.soundId),
      }));
    },
  });

export async function createPreset(
  name: string,
  mix: PresetMixItem[],
  master: number,
  catalog: CatalogSound[],
) {
  const clean = validatePreset(name, mix);
  const bySlug = new Map(catalog.map((s) => [s.slug, s.id]));
  const { data: preset, error } = await supabase
    .from("presets")
    .insert({ name: clean, master_volume: Math.round(master) })
    .select("id")
    .single();
  if (error) throw error;
  const rows = mix
    .filter((m) => bySlug.has(m.soundId))
    .map((m, i) => ({
      preset_id: preset.id,
      sound_id: bySlug.get(m.soundId)!,
      volume: Math.round(m.volume),
      position: i,
    }));
  const { error: e2 } = await supabase.from("preset_sounds").insert(rows);
  if (e2) {
    await supabase.from("presets").delete().eq("id", preset.id);
    throw e2;
  }
  return preset.id;
}

export async function removePreset(id: string) {
  const { error } = await supabase.from("presets").delete().eq("id", id);
  if (error) throw error;
}

export const favoritesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["favorites", userId],
    queryFn: async (): Promise<Favorite[]> => {
      const { data, error } = await supabase.from("favorites").select("id, sound_id, preset_id");
      if (error) throw error;
      return data;
    },
  });

export async function toggleFavorite(
  userId: string,
  target: { soundId?: string; presetId?: string },
  existing?: Favorite,
) {
  if (existing) {
    const { error } = await supabase.from("favorites").delete().eq("id", existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("favorites").insert({
    user_id: userId,
    sound_id: target.soundId ?? null,
    preset_id: target.presetId ?? null,
  });
  if (error) throw error;
}

export async function logPlay(presetId: string) {
  await supabase.from("play_history").insert({ preset_id: presetId });
}

export const historyQuery = (userId: string) =>
  queryOptions({
    queryKey: ["history", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("play_history")
        .select("id, played_at, presets(name)")
        .order("played_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export async function updateUsername(userId: string, username: string) {
  const clean = username.trim();
  if (clean.length < 2 || clean.length > 40)
    throw new Error("O nome deve ter entre 2 e 40 caracteres");
  const { error } = await supabase.from("profiles").update({ username: clean }).eq("id", userId);
  if (error) throw error;
}
