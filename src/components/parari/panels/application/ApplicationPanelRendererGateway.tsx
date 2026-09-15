// src/components/parari/panels/application/ApplicationPanelRendererGateway.tsx
// 2026-09-15 JST
//
// Authenticated visitors keep the existing APPLICATION experience.
// Unauthenticated visitors use the guest APPLICATION flow.

"use client";

import * as React from "react";

import { supabase } from "@/lib/supabaseClient";
import type { PanelRendererProps } from "../panelDefinitionTypes";
import type { ApplicationPanelData } from "./applicationTypes";
import ApplicationPanelRenderer from "./ApplicationPanelRenderer";
import GuestApplicationPanelRenderer from "./GuestApplicationPanelRenderer";

export default function ApplicationPanelRendererGateway(
  props: PanelRendererProps<ApplicationPanelData>,
) {
  const [authState, setAuthState] =
    React.useState<
      "checking" | "authenticated" | "guest"
    >("checking");

  React.useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      setAuthState(
        session
          ? "authenticated"
          : "guest",
      );
    }

    void loadSession();

    const {
      data: listener,
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) {
          return;
        }

        setAuthState(
          session
            ? "authenticated"
            : "guest",
        );
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (authState === "checking") {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          APPLICATION
        </div>
        <div className="mt-3 text-sm text-neutral-500">
          募集情報を読み込んでいます...
        </div>
      </section>
    );
  }

  if (authState === "authenticated") {
    return (
      <ApplicationPanelRenderer
        {...props}
      />
    );
  }

  return (
    <GuestApplicationPanelRenderer
      {...props}
    />
  );
}
