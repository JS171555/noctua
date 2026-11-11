import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, Sparkles, Timer } from "lucide-react";
import dioramaVideo from "@/assets/home-diorama.webm";
import { experiences, filterExperiencesByMood, moods } from "@/data/sounds";
import {
  Chip,
  ExperienceCard,
  Fireflies,
  GhostButton,
  GlowButton,
  Page,
  SectionTitle,
} from "@/components/noctua";
import { useAudio } from "@/services/audio/use-audio";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Noctua — Um pequeno universo noturno de sons" },
      {
        name: "description",
        content:
          "Combine chuva, floresta, lareira e oceano em atmosferas para dormir, relaxar e concentrar.",
      },
      { property: "og:title", content: "Noctua — Um pequeno universo noturno de sons" },
      {
        property: "og:description",
        content: "Atmosferas sonoras ilustradas para dormir, relaxar e focar.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const [mood, setMood] = useState<string | null>(null);
  const { engine } = useAudio();
  const filteredExperiences = filterExperiencesByMood(mood);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return (
    <>
      <section className="relative h-[78vh] min-h-[520px] w-full overflow-hidden">
        <video
          src={dioramaVideo}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="scrim absolute inset-0" />
        <Fireflies />
        <div className="relative mx-auto flex h-full max-w-xl flex-col justify-between px-5 pb-8 pt-8">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-ui text-xs uppercase tracking-[0.3em] text-foreground/90">
              <img
                src="/noctua-mark-96.webp"
                alt=""
                aria-hidden="true"
                width={24}
                height={24}
                className="h-6 w-6 rounded-md object-cover"
              />
              Noctua
            </span>
            <span
              className="nav-glass rounded-full border px-3 py-1 font-ui text-xs text-muted-foreground"
              suppressHydrationWarning
            >
              {greet}
            </span>
          </div>
          <div>
            <h1 className="text-editorial text-[clamp(2rem,10vw,3rem)] leading-[0.95]">
              Onde a noite
              <br />
              <em className="text-primary not-italic">silencia</em> o mundo.
            </h1>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Atmosferas sonoras para adormecer, respirar e encontrar foco.
            </p>
            <div className="mt-6 flex gap-3">
              <Link
                to="/studio"
                onClick={() => void engine.loadMix(experiences[3]!.mix, { autoplay: true })}
              >
                <GlowButton>
                  <Play className="h-4 w-4 fill-current" /> Entrar na casa do lago
                </GlowButton>
              </Link>
              <Link to="/studio">
                <GhostButton aria-label="Temporizador">
                  <Timer className="h-4 w-4" />
                </GhostButton>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Page className="pt-2">
        <div data-reveal className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          <Chip active={mood === null} onClick={() => setMood(null)}>
            Todas
          </Chip>
          {moods.map((m) => (
            <Chip key={m} active={m === mood} onClick={() => setMood(m)}>
              {m}
            </Chip>
          ))}
        </div>

        <SectionTitle
          action={
            <Link to="/explore" className="font-ui text-xs text-primary">
              Ver tudo
            </Link>
          }
        >
          Atmosferas da noite
        </SectionTitle>
        {filteredExperiences.length > 0 ? (
          <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-2">
            {filteredExperiences.map((e) => (
              <ExperienceCard key={e.id} exp={e} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed bg-card/40 px-6 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Ainda não há atmosferas para {mood?.toLowerCase()}.
            </p>
            <GhostButton className="mt-4" onClick={() => setMood(null)}>
              Ver todas
            </GhostButton>
          </div>
        )}

        <SectionTitle>Crie a sua</SectionTitle>
        <Link
          to="/studio"
          data-reveal
          className="block rounded-3xl border bg-card p-5 shadow-card"
        >
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary shadow-glow">
              <Sparkles className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-editorial text-xl">Sound Studio</h3>
              <p className="text-sm text-muted-foreground">Misture sons e ajuste cada volume.</p>
            </div>
          </div>
        </Link>
      </Page>
    </>
  );
}
