import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { isSupabaseConfigured } from "@/integration/supabase/client";

describe("optional Supabase configuration", () => {
  it("does not attempt to initialize auth when environment variables are absent", async () => {
    expect(isSupabaseConfigured).toBe(false);

    let loading: boolean | undefined;
    function Probe() {
      const auth = useAuth();
      useEffect(() => {
        loading = auth.loading;
      }, [auth.loading]);
      return null;
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(AuthProvider, null, createElement(Probe)));
    });
    expect(loading).toBe(false);
    await act(async () => root.unmount());
    container.remove();
  });
});
