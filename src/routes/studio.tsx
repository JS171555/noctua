import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Timer,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { categories, sounds, soundById } from "@/data/sounds";
import {
  Chip,
  EmptyState,
  GhostButton,
  GlowButton,
  GlowSlider,
  Page,
  PageHeader,
  SectionTitle,
} from "@/components/noctua";
import { useAudio } from "@/services/audio/use-audio";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  createPreset,
  errorMessage,
  logPlay,
  presetsQuery,
  removePreset,
  soundsQuery,
} from "@/services/supabase/noctua-api";
import { formatRemaining } from "@/services/audio/sleep-timer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Sound Studio — Noctua" },
      {
        name: "description",
        content: "Combine sons de chuva, vento, lareira e oceano com volumes independentes.",
      },
      { property: "og:title", content: "Sound Studio — Noctua" },
      { property: "og:description", content: "Crie sua própria atmosfera sonora." },
    ],
  }),
  component: Studio,
});

const TIMERS = [15, 30, 60, 90];

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function Studio() {
  const { engine, state, playing } = useAudio();
  const [cat, setCat] = useState<(typeof categories)[number]>("Chuva");
  const { user } = useAuth();
  const qc = useQueryClient();
  const catalog = useQuery(soundsQuery);
  const presetsQ = useQuery({ ...presetsQuery(user?.id ?? "anon"), enabled: !!user });
  const presets = presetsQ.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["presets", user?.id] });
  const del = useMutation({
    mutationFn: removePreset,
    onSuccess: refresh,
    onError: (e) => setMsg(errorMessage(e)),
  });
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const now = useNow(state.timerEndsAt !== null);
  const active = Object.keys(state.channels);

  const onSave = async () => {
    if (!user) {
      setMsg("Entre na sua conta para salvar");
      return;
    }
    try {
      await createPreset(
        name,
        active.map((id) => ({ soundId: id, volume: state.channels[id] ?? 50 })),
        state.master,
        catalog.data ?? [],
      );
      await refresh();
      setNaming(false);
      setName("");
      setMsg("Atmosfera salva");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível salvar");
    }
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Sound Studio"
        title="Sua atmosfera"
        action={
          active.length > 0 && (
            <GhostButton onClick={() => engine.clear()} aria-label="Limpar mistura">
              <RotateCcw className="h-4 w-4" />
            </GhostButton>
          )
        }
      />

      {state.status === "interrupted" && (
        <button
          onClick={() => engine.resume()}
          className="mb-4 flex w-full items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 p-3 font-ui text-sm text-primary"
        >
          <AlertCircle className="h-4 w-4" /> O som foi interrompido. Toque para retomar.
        </button>
      )}

      {active.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="Silêncio por enquanto"
          text="Toque nos sons abaixo para começar a montar sua mistura."
        />
      ) : (
        <div data-reveal className="space-y-3 rounded-3xl border bg-card p-4 shadow-card">
          {active.map((id) => {
            const s = soundById(id);
            const loading = state.loading.includes(id);
            const err = state.errors[id];
            return (
              <div key={id} className="flex items-center gap-3">
                <div
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary",
                    playing && !loading && !err && "shadow-glow",
                  )}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <s.icon className="h-5 w-5" strokeWidth={1.75} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between font-ui text-xs">
                    <span>{s.name}</span>
                    <span className="text-muted-foreground">{state.channels[id]}%</span>
                  </div>
                  {err ? (
                    <button
                      onClick={() => engine.retry(id)}
                      className="font-ui text-xs text-destructive"
                    >
                      {err} — tentar de novo
                    </button>
                  ) : (
                    <GlowSlider
                      label={`Volume de ${s.name}`}
                      value={state.channels[id] ?? 0}
                      onChange={(v) => engine.setVolume(id, v)}
                    />
                  )}
                </div>
                <button
                  onClick={() => engine.removeSound(id)}
                  aria-label={`Remover ${s.name}`}
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          <div className="flex items-center gap-3 border-t pt-3">
            <Volume2 className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="flex justify-between font-ui text-xs">
                <span>Volume geral</span>
                <span className="text-muted-foreground">{state.master}%</span>
              </div>
              <GlowSlider
                label="Volume geral"
                value={state.master}
                onChange={(v) => engine.setMaster(v)}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <GlowButton className="flex-1" onClick={() => void engine.toggle()}>
              {playing ? (
                <>
                  <Pause className="h-4 w-4 fill-current" /> Pausar
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" /> Tocar
                </>
              )}
            </GlowButton>
            <GhostButton
              onClick={() => {
                setNaming((n) => !n);
                setMsg(null);
              }}
            >
              <Save className="h-4 w-4" /> Salvar
            </GhostButton>
          </div>

          {naming && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void onSave();
              }}
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="Nome da atmosfera"
                className="flex-1 rounded-full border bg-background/60 px-4 py-2.5 font-ui text-sm outline-none focus:border-primary/60"
              />
              <GlowButton type="submit" className="px-4">
                OK
              </GlowButton>
            </form>
          )}
          {msg && <p className="font-ui text-xs text-primary">{msg}</p>}

          <div className="border-t pt-3">
            <p className="mb-2 flex items-center gap-2 font-ui text-xs text-muted-foreground">
              <Timer className="h-4 w-4" />
              {state.timerEndsAt ? (
                <>
                  Desliga em{" "}
                  <span className="text-primary">{formatRemaining(state.timerEndsAt - now)}</span>
                </>
              ) : (
                "Temporizador"
              )}
            </p>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              <Chip
                active={!state.timerEndsAt}
                onClick={() => {
                  setChosen(null);
                  engine.setTimer(null);
                }}
              >
                Sem
              </Chip>
              {TIMERS.map((m) => (
                <Chip
                  key={m}
                  active={!!state.timerEndsAt && chosen === m}
                  onClick={() => {
                    setChosen(m);
                    engine.setTimer(m);
                  }}
                >
                  {m} min
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}

      <div data-reveal className="no-scrollbar -mx-5 mt-8 flex gap-2 overflow-x-auto px-5">
        {categories.map((c) => (
          <Chip key={c} active={c === cat} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {sounds
          .filter((s) => s.category === cat)
          .map((s) => {
            const on = s.id in state.channels;
            return (
              <button
                key={s.id}
                onClick={() => engine.toggleSound(s.id)}
                aria-pressed={on}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-center transition-all active:scale-95",
                  on
                    ? "border-primary/50 bg-primary/10 text-primary shadow-glow"
                    : "bg-card/70 text-muted-foreground",
                )}
              >
                <s.icon className="h-6 w-6" strokeWidth={1.5} />
                <span className="font-ui text-[11px] leading-tight">{s.name}</span>
              </button>
            );
          })}
      </div>

      <SectionTitle>Minhas atmosferas</SectionTitle>
      {!user ? (
        <p className="font-ui text-sm text-muted-foreground">
          <Link to="/login" className="text-primary">
            Entre
          </Link>{" "}
          para salvar e ver suas misturas.
        </p>
      ) : presetsQ.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : presetsQ.isError ? (
        <p className="font-ui text-sm text-destructive">{errorMessage(presetsQ.error)}</p>
      ) : presets.length === 0 ? (
        <p className="font-ui text-sm text-muted-foreground">Suas misturas salvas aparecem aqui.</p>
      ) : (
        <ul className="space-y-2">
          {presets.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border bg-card/70 p-3">
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
                <span>
                  <span className="block font-ui text-sm">{p.name}</span>
                  <span className="block font-ui text-xs text-muted-foreground">
                    {p.mix.map((m: { soundId: string }) => soundById(m.soundId).name).join(" · ")}
                  </span>
                </span>
              </button>
              <button
                aria-label={`Apagar ${p.name}`}
                onClick={() => del.mutate(p.id)}
                className="text-muted-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
