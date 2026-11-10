import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import rain from "@/assets/scene-rain.jpg";
import { Fireflies, GlowButton } from "@/components/noctua";
import { isSupabaseConfigured, supabase } from "@/integration/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/services/supabase/noctua-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Noctua" },
      { name: "description", content: "Entre na sua conta Noctua para salvar suas atmosferas." },
      { property: "og:title", content: "Entrar — Noctua" },
      { property: "og:description", content: "Entre na sua conta Noctua." },
    ],
  }),
  component: Login,
});

type Mode = "signin" | "signup" | "forgot";

const inputCls =
  "nav-glass w-full rounded-2xl border px-4 py-3.5 font-ui text-sm outline-none focus:border-primary/60";

function translate(msg: string) {
  if (/invalid login/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar.";
  if (/already registered/i.test(msg)) return "Este e-mail já tem conta. Tente entrar.";
  if (/at least 6/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
  return msg;
}

function Login() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) void navigate({ to: "/profile" });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    if (!isSupabaseConfigured) {
      setError("Configure o Supabase no arquivo .env para habilitar login e cadastro.");
      setBusy(false);
      return;
    }
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setInfo("Enviamos um link de confirmação para o seu e-mail.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setInfo(
          "Se houver uma conta com esse e-mail, você receberá um link para criar nova senha.",
        );
      }
    } catch (err) {
      setError(translate(errorMessage(err)));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Configure o Supabase no arquivo .env para habilitar login com Google.");
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) setError(translate(errorMessage(error)));
    } catch (err) {
      setError(translate(errorMessage(err)));
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <img
        src={rain}
        alt=""
        width={768}
        height={960}
        className="absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <div className="scrim absolute inset-0" />
      <Fireflies count={8} />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
        <Link
          to="/"
          aria-label="Voltar"
          className="nav-glass grid h-10 w-10 place-items-center rounded-full border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="mt-auto">
          <Moon className="h-8 w-8 text-primary" strokeWidth={1.5} />
          <h1 className="text-editorial mt-3 text-5xl leading-none">
            {mode === "signup" ? (
              <>
                Crie sua
                <br />
                conta.
              </>
            ) : mode === "forgot" ? (
              <>
                Nova
                <br />
                senha.
              </>
            ) : (
              <>
                Bem-vindo
                <br />
                de volta.
              </>
            )}
          </h1>

          {!isSupabaseConfigured && (
            <p className="mt-3 font-ui text-xs text-muted-foreground">
              O acesso a contas fica desativado até configurar o Supabase no arquivo .env.
            </p>
          )}
          {mode !== "forgot" && (
            <div className="nav-glass mt-6 grid grid-cols-2 rounded-full border p-1 font-ui text-sm">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                    setInfo(null);
                  }}
                  className={cn(
                    "rounded-full py-2 transition-colors",
                    mode === m ? "bg-primary/20 text-primary" : "text-muted-foreground",
                  )}
                >
                  {m === "signin" ? "Entrar" : "Cadastrar"}
                </button>
              ))}
            </div>
          )}

          <form className="mt-4 space-y-3" onSubmit={submit}>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              className={inputCls}
            />
            {mode !== "forgot" && (
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                className={inputCls}
              />
            )}
            {error && (
              <p role="alert" className="font-ui text-sm text-destructive">
                {error}
              </p>
            )}
            {info && <p className="font-ui text-sm text-primary">{info}</p>}
            <GlowButton type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
            </GlowButton>
          </form>

          {mode === "forgot" ? (
            <button
              onClick={() => setMode("signin")}
              className="mt-4 w-full text-center font-ui text-xs text-muted-foreground"
            >
              Voltar para entrar
            </button>
          ) : (
            <>
              <div className="my-5 flex items-center gap-3 font-ui text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                ou
                <span className="h-px flex-1 bg-border" />
              </div>
              <button
                type="button"
                onClick={google}
                className="flex w-full items-center justify-center gap-[10px] rounded-full border border-[#747775] bg-[#FFFFFF] px-3 py-3 font-ui text-sm font-medium text-[#1F1F1F]"
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.480-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.070 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.570.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                Continuar com Google
              </button>
              {mode === "signin" && (
                <button
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                    setInfo(null);
                  }}
                  className="mt-4 w-full text-center font-ui text-xs text-muted-foreground hover:text-primary"
                >
                  Esqueci minha senha
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
