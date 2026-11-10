import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { experiences, moods } from "@/data/sounds";
import { Chip, EmptyState, ExperienceCard, Page, PageHeader } from "@/components/noctua";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explorar atmosferas — Noctua" },
      {
        name: "description",
        content: "Descubra ambientes sonoros para dormir, ler, meditar e estudar.",
      },
      { property: "og:title", content: "Explorar atmosferas — Noctua" },
      { property: "og:description", content: "Descubra ambientes sonoros ilustrados." },
    ],
  }),
  component: Explore,
});

function Explore() {
  const [q, setQ] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const list = experiences.filter(
    (e) => (!mood || e.mood === mood) && e.title.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <Page>
      <PageHeader eyebrow="Explorar" title="Pequenos universos" />
      <label
        data-reveal
        className="flex items-center gap-3 rounded-full border bg-card/70 px-4 py-3"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar atmosfera"
          className="w-full bg-transparent font-ui text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>
      <div data-reveal className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
        <Chip active={!mood} onClick={() => setMood(null)}>
          Todas
        </Chip>
        {moods.map((m) => (
          <Chip key={m} active={m === mood} onClick={() => setMood(m)}>
            {m}
          </Chip>
        ))}
      </div>
      <div className="mt-6 grid gap-4">
        {list.length ? (
          list.map((e) => <ExperienceCard key={e.id} exp={e} size="lg" />)
        ) : (
          <EmptyState
            icon={Search}
            title="Nada por aqui"
            text="Nenhuma atmosfera combina com essa busca ainda."
          />
        )}
      </div>
    </Page>
  );
}
