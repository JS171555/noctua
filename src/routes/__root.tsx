import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { Smartphone } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AppProvider } from "../state/app-store";
import { AuthProvider } from "../hooks/use-auth";
import { Toaster } from "../components/ui/sonner";
import { BottomNav } from "../components/noctua";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ reset }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Replace these placeholders with the app's name and description when first building the app.
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
      },
      { title: "Noctua — Sons para dormir, relaxar e concentrar" },
      {
        name: "description",
        content: "Atmosferas sonoras ilustradas para dormir, relaxar e focar.",
      },
      { name: "theme-color", content: "#071512" },
      { property: "og:title", content: "Noctua" },
      {
        property: "og:description",
        content: "Atmosferas sonoras ilustradas para dormir, relaxar e focar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Inter:wght@400;500;600&display=swap",
      },
      { rel: "manifest", href: "/manifest.json" },
      {
        rel: "icon",
        href: "/icons/noctua-favicon-32.png",
        type: "image/png",
        sizes: "32x32",
      },
      {
        rel: "apple-touch-icon",
        href: "/icons/noctua-apple-touch-icon.png",
        sizes: "180x180",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body className="grain min-h-screen">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [desktopRestricted, setDesktopRestricted] = useState(false);

  useEffect(() => {
    const desktopPointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    );
    const updateRestriction = () =>
      setDesktopRestricted(desktopPointer.matches);

    updateRestriction();
    desktopPointer.addEventListener("change", updateRestriction);
    return () =>
      desktopPointer.removeEventListener("change", updateRestriction);
  }, []);

  return (
    <>
      {!desktopRestricted && (
        <div className="app-interface">
          <QueryClientProvider client={queryClient}>
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <AuthProvider>
              <AppProvider>
                <Outlet />
                <BottomNav />
                <Toaster position="top-center" />
              </AppProvider>
            </AuthProvider>
          </QueryClientProvider>
        </div>
      )}
      <DesktopAccessNotice />
    </>
  );
}

function DesktopAccessNotice() {
  return (
    <main className="desktop-access-notice min-h-screen place-items-center px-8 py-16 text-center">
      <div className="mx-auto max-w-xl">
        <span className="mx-auto flex w-fit items-center gap-2 font-ui text-xs uppercase tracking-[0.3em] text-foreground/90">
          <img
            src="/noctua-mark-96.webp"
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
            className="h-6 w-6 rounded-md object-cover"
          />
          NOCTUA
        </span>
        <div
          className="mx-auto mt-10 grid h-14 w-14 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary shadow-glow"
        >
          <Smartphone className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <p className="mt-8 font-ui text-xs uppercase tracking-[0.2em] text-primary">
          Feito para o toque
        </p>
        <h1 className="text-editorial mx-auto mt-3 text-4xl leading-tight">
          O NOCTUA é feito para o toque.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Para continuar, abra esta página em um celular ou tablet.
        </p>
      </div>
    </main>
  );
}
