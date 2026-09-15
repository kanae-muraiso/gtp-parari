"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

type AccessRow = {
  is_superuser: boolean | null;
  parari_role: string | null;
  cpp_role: string | null;
};

export default function useParariStaff() {
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [parariRole, setParariRole] = useState<string | null>(null);
  const [cppRole, setCppRole] = useState<string | null>(null);
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
        setIsSuperuser(false);
        setParariRole(null);
        setCppRole(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc("get_my_operations_access");

      if (!mounted) return;

      if (error) {
        setIsSuperuser(false);
        setParariRole(null);
        setCppRole(null);
        setLoading(false);
        return;
      }

      const row = (Array.isArray(data) ? data[0] : data) as AccessRow | null;

      setIsSuperuser(Boolean(row?.is_superuser));
      setParariRole(row?.parari_role ?? null);
      setCppRole(row?.cpp_role ?? null);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const canParari = Boolean(parariRole) || isSuperuser;
  const canCpp = Boolean(cppRole) || isSuperuser;
  const isStaff = canParari || canCpp || isSuperuser;

  return {
    isStaff,
    isSuperuser,
    canParari,
    canCpp,
    parariRole,
    cppRole,
    loading,
  };
}
