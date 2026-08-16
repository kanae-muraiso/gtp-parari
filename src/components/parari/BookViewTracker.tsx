// src/components/parari/BookViewTracker.tsx
// 2026-03-28 JST

"use client";

/**
 * PART: BookViewTracker
 * コメント:
 * - 作品詳細を開いたときに viewed を記録する
 * - 同じ user + book + viewed は upsert で1件維持
 * - created_at を毎回更新して「最近読んだ」を成立させる
 */

import { useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";

type Props = {
  bookId: string;
};

export default function BookViewTracker({ bookId }: Props) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (!bookId || sentRef.current) return;
    sentRef.current = true;

      async function track() {
        if (!supabase) return;

        const {
          data: { user },
        } = await supabase.auth.getUser();
          
      if (!user) return;

      await supabase.from("user_bookshelf").upsert(
        {
          user_id: user.id,
          book_id: bookId,
          type: "viewed",
          created_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,book_id,type",
        }
      );
    }

    track();
  }, [bookId]);

  return null;
}
