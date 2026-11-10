import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GlowButton, Page, PageHeader } from "@/components/noctua";
import { supabase } from "@/integration/supabase/client";
import { errorMessage } from "@/services/supabase/noctua-api";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Criar nova senha — Noctua" },
      { name: "description", content: "Defina uma nova senha para sua conta Noctua." },
      { property: "og:title", content: "Criar nova senha — Noctua" },
      { property: "og:description", content: "Defina uma nova senha." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    toast.success("Senha atualizada");
    void navigate({ to: "/profile" });
  };

  return (
    <Page>
      <PageHeader eyebrow="Conta" title="Nova senha" />
      <form onSubmit={submit} className="space-y-3 rounded-3xl border bg-card p-5 shadow-card">
        <KeyRound className="h-6 w-6 text-primary" />
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nova senha (mín. 6 caracteres)"
          className="w-full rounded-2xl border bg-background/60 px-4 py-3.5 font-ui text-sm outline-none focus:border-primary/60"
        />
        {error && (
          <p role="alert" className="font-ui text-sm text-destructive">
            {error}
          </p>
        )}
        <GlowButton type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar nova senha
        </GlowButton>
      </form>
    </Page>
  );
}
