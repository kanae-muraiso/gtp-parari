// src/components/parari/BookSaveButton.tsx
// src/components/parari/BookSaveButton.tsx
// 2026-04-05 JST

"use client";

/**
 * PART: BookSaveButton
 * コメント:
 * - read_later / shelf / participant / managed に対応
 * - 未ログイン時は /login へ移動
 * - あとで読むは旧形式の shelf も含めてトグルする
 * - 現在UIボタンとして主に使うのは read_later / shelf
 * - participant / managed は自動追加用の型として先に受けられるようにしておく
 */

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type ShelfType =
  | "read_later"
  | "shelf"
  | "viewed"
  | "participant"
  | "managed";

type Props = {
  bookId: string;
  type: ShelfType;
  idleLabel: string;
  activeLabel: string;
  appearance?: "light" | "dark";
};

const readLaterTypes = ["read_later", "shelf"];

export default function BookSaveButton({
  bookId,
  type,
  idleLabel,
  activeLabel,
  appearance = "dark",
}: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    
    useEffect(() => {
        let mounted = true;
        
        async function load() {
            setLoading(true);
            
            if (!supabase) {
                if (!mounted) return;
                setUserId(null);
                setIsActive(false);
                setLoading(false);
                return;
            }
            
            const {
                data: { user },
            } = await supabase.auth.getUser();
            
            if (!mounted) return;
            
            if (!user) {
                setUserId(null);
                setIsActive(false);
                setLoading(false);
                return;
            }
            
            setUserId(user.id);
            
            const { data, error } = await supabase
            .from("user_bookshelf")
            .select("id")
            .eq("user_id", user.id)
            .eq("book_id", bookId)
            .in("type", type === "read_later" ? readLaterTypes : [type])
            .limit(1)
            .maybeSingle();
            
            if (!mounted) return;
            
            if (!error && data) {
                setIsActive(true);
            } else {
                setIsActive(false);
            }
            
            setLoading(false);
        }
        
        void load();
        
        return () => {
            mounted = false;
        };
    }, [bookId, type]);
    
    useEffect(() => {
        if (!supabase) return;
        const refresh = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from("user_bookshelf").select("id")
                .eq("user_id", user.id).eq("book_id", bookId).in("type", type === "read_later" ? readLaterTypes : [type]).limit(1).maybeSingle();
            setIsActive(Boolean(data));
        };
        window.addEventListener("parari-library-updated", refresh);
        return () => window.removeEventListener("parari-library-updated", refresh);
    }, [bookId, type]);

    async function toggle() {
        if (saving) return;
        
        if (!userId) {
            const returnTo =
                window.location.pathname +
                window.location.search +
                window.location.hash;

            if ((type === "read_later" || type === "shelf") && window.location.pathname.startsWith("/p/")) {
                const action = type === "read_later" ? "later" : "save";
                window.location.href = `/join/library?action=${action}&workId=${encodeURIComponent(bookId)}`;
            } else {
                window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
            }
            return;
        }
        
        if (!supabase) return;
        
        setSaving(true);
        
        if (isActive) {
            const { error } = await supabase
            .from("user_bookshelf")
            .delete()
            .eq("user_id", userId)
            .eq("book_id", bookId)
            .in("type", type === "read_later" ? readLaterTypes : [type]);
            
            if (!error) {
                setIsActive(false);
                window.dispatchEvent(new Event("parari-library-updated"));
            }
            setSaving(false);
            return;
        }
        
        const { error } = await supabase.from("user_bookshelf").insert({
            user_id: userId,
            book_id: bookId,
            type,
        });
        
        if (!error) {
            setIsActive(true);
            window.dispatchEvent(new Event("parari-library-updated"));
        }
        setSaving(false);
    }
    
    return (
            <button
            type="button"
            onClick={toggle}
            aria-pressed={isActive}
            disabled={loading || saving}
            className={`rounded-lg border px-3 py-1 text-[12px] font-semibold transition-colors
            ${
              appearance === "light"
                ? isActive
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100"
                : isActive
                  ? "border-white bg-white text-black"
                  : "border-white/30 text-white hover:bg-white/10"
            }
            disabled:opacity-40`}
            >
            {loading
                ? "..."
                : saving
                ? "..."
                : isActive
                ? activeLabel
                : idleLabel}
            </button>
            );
}
