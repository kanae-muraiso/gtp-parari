"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

export default function useParariStaff() {
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!supabase) {
        if (mounted) setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setIsStaff(false);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("parari_staff_users")
        .select("is_active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      setIsStaff(Boolean(data?.is_active));
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return { isStaff, loading };
}
