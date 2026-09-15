"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

export type ParariExperience = {
  studioEnabled: boolean;
  hasApplications: boolean;
  hasCalendar: boolean;
  hasMessages: boolean;
  loading: boolean;
};

type ExperienceRow = {
  studio_enabled: boolean | null;
  has_applications: boolean | null;
  has_calendar: boolean | null;
  has_messages: boolean | null;
};

const EMPTY_STATE: ParariExperience = {
  studioEnabled: false,
  hasApplications: false,
  hasCalendar: false,
  hasMessages: false,
  loading: true,
};

export default function useParariExperience() {
  const [state, setState] = useState<ParariExperience>(EMPTY_STATE);

  const reload = useCallback(async () => {
    if (!supabase) {
      setState({ ...EMPTY_STATE, loading: false });
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setState({ ...EMPTY_STATE, loading: false });
      return;
    }

    const { data, error } = await supabase.rpc("get_my_parari_experience");

    if (error) {
      console.error("load PARARI experience failed:", error);
      setState({ ...EMPTY_STATE, loading: false });
      return;
    }

    const row = (Array.isArray(data) ? data[0] : data) as ExperienceRow | null;

    setState({
      studioEnabled: Boolean(row?.studio_enabled),
      hasApplications: Boolean(row?.has_applications),
      hasCalendar: Boolean(row?.has_calendar),
      hasMessages: Boolean(row?.has_messages),
      loading: false,
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!active) return;
      await reload();
    }

    void load();

    return () => {
      active = false;
    };
  }, [reload]);

  return {
    ...state,
    reload,
  };
}
