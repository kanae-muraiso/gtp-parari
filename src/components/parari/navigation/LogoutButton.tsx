// src/components/parari/navigation/LogoutButton.tsx
// 2026/08/19 21:20

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LogoutButton() {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await supabase.auth.signOut();
      window.location.href = "/";
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className="rounded-full bg-white px-4 py-2 text-xs font-bold text-neutral-500 shadow-sm ring-1 ring-neutral-200 transition hover:bg-neutral-50 disabled:opacity-50"
    >
      {loggingOut ? "..." : "Logout"}
    </button>
  );
}
