"use client";

import { useEffect } from "react";

import { supabase } from "@/lib/supabaseClient";
import { notifyParariExperienceChanged } from "@/components/parari/hooks/useParariExperience";

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

      const { data: existing, error: readError } = await supabase
        .from("user_workspace_preferences")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled || readError) return;

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

      const { error } = await supabase.from("user_workspace_preferences").insert({
        user_id: user.id,
        studio_enabled: false,
        start_destination: workspace,
        last_workspace: workspace,
        updated_at: now,
      });
      if (!error) notifyParariExperienceChanged();
    }

    void recordVisit();

    return () => {
      cancelled = true;
    };
  }, [workspace]);

  return null;
}
