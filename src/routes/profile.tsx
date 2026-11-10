import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  History,
  Loader2,
  LogIn,
  LogOut,
  Moon,
  Pencil,
  Sun,
  Timer,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GhostButton, GlowButton, Page, PageHeader, SectionTitle } from "@/components/noctua";
import { useApp } from "@/state/app-store";
import { useAuth } from "@/hooks/use-auth";
import {
  errorMessage,
  favoritesQuery,
  historyQuery,
  presetsQuery,
  profileQuery,
  updateUsername,
} from "@/services/supabase/noctua-api";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Perfil — Noctua" },
      { name: "description", content: "Preferências, tema e sua conta Noctua." },
      { property: "og:title", content: "Perfil — Noctua" },
      { property: "og:description", content: "Preferências e conta Noctua." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { theme, toggleTheme } = useApp();
  const { user, loading, signOut } = useAuth();

  return (
    <Page>
      <PageHeader eyebrow="Perfil" title={user ? "Sua noite" : "Viajante noturno"} />
      {loading ? (
        <div className="grid place-items-center py-10 text-primary">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : user ? (
        <Account userId={user.id} email={user.email ?? ""} />
      ) : (
        <div data-reveal className="rounded-3xl border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">
            Entre para salvar suas misturas, favoritos e histórico.
          </p>
          <Link to="/login">
            <GlowButton className="mt-4 w-full">
              <LogIn className="h-4 w-4" /> Entrar ou criar conta
            </GlowButton>
          </Link>
        </div>
      )}

      <ul className="mt-6 divide-y overflow-hidden rounded-3xl border bg-card">
        <li>
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 p-4 text-left hover:bg-surface-2"
          >
            {theme === "dark" ? (
              <Moon className="h-5 w-5 text-primary" />
            ) : (
              <Sun className="h-5 w-5 text-primary" />
            )}
            <span className="flex-1 font-ui text-sm">Tema</span>
            <span className="font-ui text-xs text-muted-foreground">
              {theme === "dark" ? "Midnight Forest" : "Dawn Mist"}
            </span>
          </button>
        </li>
        <li>
          <Link to="/studio" className="flex items-center gap-3 p-4 hover:bg-surface-2">
            <Timer className="h-5 w-5 text-primary" />
            <span className="flex-1 font-ui text-sm">Temporizador e misturas</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </li>
        {user && (
          <li>
            <button
              onClick={async () => {
                await signOut();
                toast("Você saiu da conta");
              }}
              className="flex w-full items-center gap-3 p-4 text-left hover:bg-surface-2"
            >
              <LogOut className="h-5 w-5 text-primary" />
              <span className="flex-1 font-ui text-sm">Sair</span>
            </button>
          </li>
        )}
      </ul>
    </Page>
  );
}

function Account({ userId, email }: { userId: string; email: string }) {
  const qc = useQueryClient();
  const profile = useQuery(profileQuery(userId));
  const presets = useQuery(presetsQuery(userId));
  const favs = useQuery(favoritesQuery(userId));
  const history = useQuery(historyQuery(userId));
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const save = useMutation({
    mutationFn: () => updateUsername(userId, name),
    onSuccess: () => {
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success("Nome atualizado");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <div data-reveal className="rounded-3xl border bg-card p-5 shadow-card">
        {profile.isError ? (
          <p className="font-ui text-sm text-destructive">{errorMessage(profile.error)}</p>
        ) : editing ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className="flex-1 rounded-full border bg-background/60 px-4 py-2.5 font-ui text-sm outline-none focus:border-primary/60"
            />
            <GlowButton type="submit" className="px-4" disabled={save.isPending}>
              OK
            </GlowButton>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-editorial text-2xl">
                {profile.isLoading ? "…" : (profile.data?.username ?? "Sem nome")}
              </p>
              <p className="font-ui text-xs text-muted-foreground">{email}</p>
            </div>
            <GhostButton
              aria-label="Editar nome"
              onClick={() => {
                setName(profile.data?.username ?? "");
                setEditing(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </GhostButton>
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl bg-surface-2 p-3">
            <p className="text-editorial text-3xl">{favs.data?.length ?? "–"}</p>
            <p className="font-ui text-xs text-muted-foreground">Favoritos</p>
          </div>
          <div className="rounded-2xl bg-surface-2 p-3">
            <p className="text-editorial text-3xl">{presets.data?.length ?? "–"}</p>
            <p className="font-ui text-xs text-muted-foreground">Misturas</p>
          </div>
        </div>
      </div>

      <SectionTitle>Ouvidas recentemente</SectionTitle>
      {history.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : history.isError ? (
        <p className="font-ui text-sm text-destructive">{errorMessage(history.error)}</p>
      ) : history.data!.length === 0 ? (
        <p className="font-ui text-sm text-muted-foreground">
          Toque numa atmosfera salva para ela aparecer aqui.
        </p>
      ) : (
        <ul className="space-y-2">
          {history.data!.map((h) => (
            <li
              key={h.id}
              className="flex items-center gap-3 rounded-2xl border bg-card/70 p-3 font-ui text-sm"
            >
              <History className="h-4 w-4 text-primary" />
              <span className="flex-1">{h.presets?.name ?? "Atmosfera"}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(h.played_at).toLocaleDateString("pt-BR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
