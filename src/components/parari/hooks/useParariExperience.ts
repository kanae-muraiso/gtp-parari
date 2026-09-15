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

const EXPERIENCE_CHANGED_EVENT = "parari-experience-changed";

const EMPTY_STATE: ParariExperience = {
  studioEnabled: false,
  hasApplications: false,
  hasCalendar: false,
  hasMessages: false,
  loading: true,
};

export function notifyParariExperienceChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EXPERIENCE_CHANGED_EVENT));
}

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
    void reload();

    function handleExperienceChanged() {
      void reload();
    }

    window.addEventListener(EXPERIENCE_CHANGED_EVENT, handleExperienceChanged);

    return () => {
      window.removeEventListener(EXPERIENCE_CHANGED_EVENT, handleExperienceChanged);
    };
  }, [reload]);

  return {
    ...state,
    reload,
  };
}
