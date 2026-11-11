import { Link, useRouterState } from "@tanstack/react-router";
import {
  Heart,
  House,
  Compass,
  SlidersHorizontal,
  User,
  Play,
  Pause,
  type LucideIcon,
} from "lucide-react";
import { useAudio } from "@/services/audio/use-audio";
import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import type { Experience } from "@/data/sounds";

const nav: {
  to: "/" | "/studio" | "/explore" | "/favorites" | "/profile";
  label: string;
  icon: LucideIcon;
}[] = [
  { to: "/", label: "Início", icon: House },
  { to: "/studio", label: "Studio", icon: SlidersHorizontal },
  { to: "/explore", label: "Explorar", icon: Compass },
  { to: "/favorites", label: "Favoritos", icon: Heart },
  { to: "/profile", label: "Perfil", icon: User },
];

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { engine, state, playing } = useAudio();
  if (path === "/login") return null;
  const count = Object.keys(state.channels).length;
  return (
    <>
      {playing && count > 0 && path !== "/studio" && (
        <div className="fixed inset-x-0 bottom-[72px] z-50 px-4">
          <div className="nav-glass mx-auto flex max-w-xl items-center gap-3 rounded-full border p-2 pl-4 shadow-card">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary shadow-glow" />
            <Link to="/studio" className="flex-1 font-ui text-sm">
              {count} {count === 1 ? "som tocando" : "sons tocando"}
            </Link>
            <button
              aria-label="Pausar"
              onClick={() => engine.pause()}
              className="bg-ember-gradient grid h-9 w-9 place-items-center rounded-full text-primary-foreground"
            >
              <Pause className="h-4 w-4 fill-current" />
            </button>
          </div>
        </div>
      )}
      <nav className="nav-glass fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-xl items-stretch justify-around px-2">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = path === to;
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  className={cn(
                    "relative flex flex-col items-center gap-1 py-3 font-ui text-[11px] transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {active && (
                    <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary shadow-glow" />
                  )}
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-reveal]",
        { y: 18, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.7, ease: "power2.out", stagger: 0.06, clearProps: "all" },
      );
    }, ref);
    return () => ctx.revert();
  }, []);
  return (
    <div ref={ref} className={cn("mx-auto w-full max-w-xl px-5 pb-28 pt-8", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header data-reveal className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="font-ui text-xs uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        )}
        <h1 className="text-editorial mt-1 text-4xl leading-none">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div data-reveal className="mb-3 mt-8 flex items-center justify-between">
      <h2 className="text-editorial text-2xl">{children}</h2>
      {action}
    </div>
  );
}

export function Fireflies({ count = 14 }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="animate-firefly absolute h-1 w-1 rounded-full bg-glow shadow-glow"
          style={{
            left: `${(i * 37) % 100}%`,
            bottom: `${(i * 23) % 60}%`,
            animationDelay: `${(i * 0.7) % 9}s`,
          }}
        />
      ))}
    </div>
  );
}

export function ExperienceCard({ exp, size = "md" }: { exp: Experience; size?: "md" | "lg" }) {
  const { engine } = useAudio();
  return (
    <article
      data-reveal
      className={cn(
        "relative shrink-0 overflow-hidden rounded-3xl border bg-card shadow-card",
        size === "lg" ? "aspect-[4/5] w-full" : "aspect-[3/4] w-44",
      )}
    >
      <img
        src={exp.image}
        alt={exp.title}
        loading="lazy"
        width={768}
        height={1024}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="scrim absolute inset-0" />
      <button
        onClick={() => void engine.loadMix(exp.mix, { autoplay: true })}
        aria-label={`Tocar ${exp.title}`}
        className="bg-ember-gradient absolute bottom-4 right-4 z-10 grid h-10 w-10 place-items-center rounded-full text-primary-foreground shadow-glow transition-transform active:scale-90"
      >
        <Play className="h-4 w-4 fill-current" />
      </button>
      <div className="absolute inset-x-0 bottom-0 p-4 pr-16">
        <p className="font-ui text-[11px] uppercase tracking-[0.18em] text-primary">{exp.mood}</p>
        <h3
          className={cn(
            "text-editorial leading-tight text-foreground",
            size === "lg" ? "text-3xl" : "text-xl",
          )}
        >
          {exp.title}
        </h3>
      </div>
    </article>
  );
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 font-ui text-sm transition-all",
        active
          ? "border-primary/60 bg-primary/15 text-primary shadow-glow"
          : "bg-card/60 text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div
      data-reveal
      className="flex flex-col items-center rounded-3xl border border-dashed bg-card/40 px-6 py-14 text-center"
    >
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary shadow-glow">
        <Icon className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <h3 className="text-editorial text-2xl">{title}</h3>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function GlowButton({
  children,
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={cn(
        "bg-ember-gradient inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-ui text-sm font-semibold text-primary-foreground shadow-glow transition-transform active:scale-95 disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border bg-card/60 px-5 py-3 font-ui text-sm text-foreground transition-transform active:scale-95",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GlowSlider({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-6 w-full accent-[var(--primary)]"
      style={{ accentColor: "var(--primary)" }}
    />
  );
}
