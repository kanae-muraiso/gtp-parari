// src/lib/parariWorkspace.ts
// 2026/09/15 JST
//
// LIBRARY / STUDIO の起動先と、最後に使った環境を扱う共通処理。
// BOOK本体のデータには一切触れない。

import { supabase } from "@/lib/supabaseClient";

export type ParariWorkspace = "library" | "studio";
export type ParariStartDestination = "library" | "studio" | "last";

export const PARARI_LIBRARY_HOME = "/mypage";
export const PARARI_STUDIO_HOME = "/my/works";

type WorkspacePreferenceRow = {
  studio_enabled: boolean | null;
  start_destination: string | null;
  last_workspace: string | null;
};

type ExperienceRow = {
  studio_enabled: boolean | null;
};

function normalizeStartDestination(value: unknown): ParariStartDestination {
  if (value === "studio" || value === "last") return value;
  return "library";
}

function normalizeWorkspace(value: unknown): ParariWorkspace {
  return value === "studio" ? "studio" : "library";
}

export async function resolveParariStartPath(
  knownUserId?: string | null,
): Promise<string> {
  if (!supabase) return PARARI_LIBRARY_HOME;

  let userId = knownUserId ?? null;

  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  if (!userId) return PARARI_LIBRARY_HOME;

  const [{ data: preferenceData }, { data: experienceData }] = await Promise.all([
    supabase
      .from("user_workspace_preferences")
      .select("studio_enabled,start_destination,last_workspace")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.rpc("get_my_parari_experience"),
  ]);

  const preference = preferenceData as WorkspacePreferenceRow | null;
  const experience = (
    Array.isArray(experienceData) ? experienceData[0] : experienceData
  ) as ExperienceRow | null;

  // 既存の作者・主催者は、明示設定がなくても制作データがあればSTUDIO利用者。
  const studioEnabled =
    Boolean(preference?.studio_enabled) || Boolean(experience?.studio_enabled);

  if (!studioEnabled) return PARARI_LIBRARY_HOME;

  const destination = normalizeStartDestination(preference?.start_destination);

  if (destination === "studio") return PARARI_STUDIO_HOME;

  if (destination === "last") {
    return normalizeWorkspace(preference?.last_workspace) === "studio"
      ? PARARI_STUDIO_HOME
      : PARARI_LIBRARY_HOME;
  }

  return PARARI_LIBRARY_HOME;
}

export async function recordParariWorkspaceVisit(
  workspace: ParariWorkspace,
): Promise<void> {
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const now = new Date().toISOString();

  const { error } = await supabase.from("user_workspace_preferences").upsert(
    {
      user_id: user.id,
      last_workspace: workspace,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.warn("record PARARI workspace visit failed:", error);
  }
}

export async function loadParariStartDestination(): Promise<ParariStartDestination> {
  if (!supabase) return "library";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "library";

  const { data, error } = await supabase
    .from("user_workspace_preferences")
    .select("start_destination")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("load PARARI start destination failed:", error);
    return "library";
  }

  return normalizeStartDestination(data?.start_destination);
}

export async function saveParariStartDestination(
  destination: ParariStartDestination,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: "設定を保存できませんでした。" };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "ログイン状態を確認できませんでした。" };

  const now = new Date().toISOString();

  const { error } = await supabase.from("user_workspace_preferences").upsert(
    {
      user_id: user.id,
      start_destination: destination,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );

  return { error: error?.message ?? null };
}
