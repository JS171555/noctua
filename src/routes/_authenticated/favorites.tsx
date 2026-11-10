import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Loader2, Play, WifiOff } from "lucide-react";
import {
  EmptyState,
  GhostButton,
  GlowButton,
  Page,
  PageHeader,
  SectionTitle,
} from "@/components/noctua";
import { useAuth } from "@/hooks/use-auth";
import { useAudio } from "@/services/audio/use-audio";
import { iconFor } from "@/data/sounds";
import {
  errorMessage,
  favoritesQuery,
  logPlay,
  presetsQuery,
  soundsQuery,
  toggleFavorite,
} from "@/services/supabase/noctua-api";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({
    meta: [
      { title: "Favoritos — Noctua" },
      { name: "description", content: "Suas atmosferas e sons preferidos, sempre à mão." },
      { property: "og:title", content: "Favoritos — Noctua" },
      { property: "og:description", content: "Suas atmosferas e sons preferidos." },
    ],
  }),
  component: Favorites,
});

function Favorites() {
  const { user } = useAuth();
  const uid = user!.id;
  const qc = useQueryClient();
  const { engine } = useAudio();
  const favs = useQuery(favoritesQuery(uid));
  const presets = useQuery(presetsQuery(uid));
  const sounds = useQuery(soundsQuery);
  const unfav = useMutation({
    mutationFn: (f: NonNullable<typeof favs.data>[number]) => toggleFavorite(uid, {}, f),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites", uid] }),
  });

  const loading = favs.isLoading || presets.isLoading || sounds.isLoading;
  const err = favs.error || presets.error || sounds.error;
  const favPresets = (presets.data ?? []).filter((p) =>
    favs.data?.some((f) => f.preset_id === p.id),
  );
  const favSounds = (sounds.data ?? []).filter((s) => favs.data?.some((f) => f.sound_id === s.id));

  return (
    <Page>
      <PageHeader eyebrow="Favoritos" title="Guardados no coração" />
      {loading ? (
        <div className="grid place-items-center py-16 text-primary">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : err ? (
        <EmptyState
          icon={WifiOff}
          title="Não foi possível carregar"
          text={errorMessage(err)}
          action={
            <GhostButton
              onClick={() => {
                void favs.refetch();
                void presets.refetch();
                void sounds.refetch();
              }}
            >
              Tentar de novo
            </GhostButton>
          }
        />
      ) : favPresets.length + favSounds.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Nenhum favorito ainda"
          text="No Studio, toque no coração de um som ou de uma atmosfera salva para guardá-la aqui."
          action={
            <Link to="/studio">
              <GlowButton>Abrir o Studio</GlowButton>
            </Link>
          }
        />
      ) : (
        <>
          {favPresets.length > 0 && (
            <>
              <SectionTitle>Atmosferas</SectionTitle>
              <ul className="space-y-2">
                {favPresets.map((p) => {
                  const f = favs.data!.find((x) => x.preset_id === p.id)!;
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-2xl border bg-card/70 p-3"
                    >
                      <button
                        className="flex flex-1 items-center gap-3 text-left"
                        onClick={() => {
                          void engine.loadMix(p.mix, { autoplay: true, master: p.master });
                          void logPlay(p.id);
                        }}
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary">
                          <Play className="h-4 w-4 fill-current" />
                        </span>
                        <span className="font-ui text-sm">{p.name}</span>
                      </button>
                      <button aria-label="Remover dos favoritos" onClick={() => unfav.mutate(f)}>
                        <Heart className="h-4 w-4 fill-primary text-primary" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {favSounds.length > 0 && (
            <>
              <SectionTitle>Sons</SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                {favSounds.map((s) => {
                  const Icon = iconFor(s.slug);
                  const f = favs.data!.find((x) => x.sound_id === s.id)!;
                  return (
                    <div
                      key={s.id}
                      className="relative flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border bg-card/70 p-2 text-center"
                    >
                      <button
                        aria-label="Remover dos favoritos"
                        onClick={() => unfav.mutate(f)}
                        className="absolute right-2 top-2"
                      >
                        <Heart className="h-3.5 w-3.5 fill-primary text-primary" />
                      </button>
                      <button
                        onClick={() => engine.addSound(s.slug, 50)}
                        className="flex flex-col items-center gap-2"
                      >
                        <Icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
                        <span className="font-ui text-[11px]">{s.name}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </Page>
  );
}
