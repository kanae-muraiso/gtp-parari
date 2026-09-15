"use client";

import { useEffect } from "react";

import { supabase } from "@/lib/supabaseClient";

type WorkspaceVisitTrackerProps = {
  workspace: "library" | "studio";
};

export default function WorkspaceVisitTracker({
  workspace,
}: WorkspaceVisitTrackerProps) {
  useEffect(() => {
    let cancelled = false;

    async function recordVisit() {
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) return;

      const now = new Date().toISOString();

      const { data: existing } = await supabase
        .from("user_workspace_preferences")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (existing) {
        await supabase
          .from("user_workspace_preferences")
          .update({
            last_workspace: workspace,
            updated_at: now,
          })
          .eq("user_id", user.id);
        return;
      }

      await supabase.from("user_workspace_preferences").insert({
        user_id: user.id,
        studio_enabled: false,
        start_destination: "library",
        last_workspace: workspace,
        updated_at: now,
      });
    }

    void recordVisit();

    return () => {
      cancelled = true;
    };
  }, [workspace]);

  return null;
}
