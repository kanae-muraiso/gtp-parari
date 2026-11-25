"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

export type ParariExperience = {
  studioEnabled: boolean;
  hasApplications: boolean;
  hasOpenSpace: boolean;
  hasParticipationPurchase: boolean;
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

type LibraryRecordsSummary = {
  memberships?: unknown[];
  applications?: unknown[];
  purchases?: unknown[];
  purchasedWorks?: unknown[];
};

const EXPERIENCE_CHANGED_EVENT = "parari-experience-changed";

const EMPTY_STATE: ParariExperience = {
  studioEnabled: false,
  hasApplications: false,
  hasOpenSpace: false,
  hasParticipationPurchase: false,
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

    const [{ data, error }, sessionResult] = await Promise.all([
      supabase.rpc("get_my_parari_experience"),
      supabase.auth.getSession(),
    ]);

    if (error) {
      console.error("load PARARI experience failed:", error);
      setState({ ...EMPTY_STATE, loading: false });
      return;
    }

    const row = (Array.isArray(data) ? data[0] : data) as ExperienceRow | null;
    const accessToken = sessionResult.data.session?.access_token;
    let hasRecords = false;

    if (accessToken) {
      try {
        const response = await fetch("/api/library-v2/records", {
          headers: { Authorization: "Bearer " + accessToken },
          cache: "no-store",
        });
        if (response.ok) {
          const records = await response.json() as LibraryRecordsSummary;
          hasRecords = [
            records.memberships,
            records.applications,
            records.purchases,
            records.purchasedWorks,
          ].some((items) => Array.isArray(items) && items.length > 0);
        }
      } catch {
        // Keep the existing experience flags when the record summary is unavailable.
      }
    }

    const hasApplications = Boolean(row?.has_applications);

    setState({
      studioEnabled: Boolean(row?.studio_enabled),
      hasApplications,
      hasOpenSpace: user.user_metadata?.library_open_space_visited === true,
      hasParticipationPurchase: hasApplications || hasRecords,
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
