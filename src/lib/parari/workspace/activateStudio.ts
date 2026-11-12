"use client";

import { notifyParariExperienceChanged } from "@/components/parari/hooks/useParariExperience";
import { supabase } from "@/lib/supabaseClient";

// STUDIO must only be enabled by a deliberate action, never by visiting its URL.
export async function activateStudioForCurrentUser(): Promise<void> {
  if (!supabase) throw new Error("接続設定がありません。");

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("ログイン状態を確認できませんでした。");

  const now = new Date().toISOString();
  const { error } = await supabase.from("user_workspace_preferences").upsert(
    {
      user_id: user.id,
      studio_enabled: true,
      studio_paused: false,
      studio_enabled_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`制作機能を有効にできませんでした: ${error.message}`);

  notifyParariExperienceChanged();
}
