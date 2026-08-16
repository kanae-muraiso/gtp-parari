// apps/tools/parari/src/components/parari/hooks/useParariBook.ts
// apps/tools/parari/src/components/parari/hooks/useParariBook.ts
// 2026-03-02 10:20 JST

"use client";

/**
 * PART: useParariBook
 * コメント:
 * - save/publish の結果を返す（onSavedでmypageへ戻すため）
 * - setStatusExternal を追加（フォーム時の警告表示用）
 */

import { useCallback, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type SaveArgs = { title: string; content: string };
type UseParariBookArgs = { initialBookId?: string | null; initialIsPublic?: boolean };

type OpResult = { ok: true; bookId: string } | { ok: false; bookId: string };

export function useParariBook({ initialBookId = null, initialIsPublic = false }: UseParariBookArgs) {
  const [bookId, setBookId] = useState<string | null>(initialBookId);
  const [isPublic, setIsPublic] = useState<boolean>(!!initialIsPublic);
  const [status, setStatus] = useState<string>("");

  const setStatusExternal = useCallback((msg: string) => setStatus(msg), []);

  const resetToNew = useCallback(() => {
    setBookId(null);
    setIsPublic(false);
    setStatus("新規ドキュメント");
  }, []);

  const save = useCallback(
    async ({ title, content }: SaveArgs): Promise<OpResult> => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        setStatus("保存失敗: " + userErr.message);
        return { ok: false, bookId: bookId ?? "" };
      }
      const user = userData.user;
      if (!user) {
        setStatus("ログインしてください");
        return { ok: false, bookId: bookId ?? "" };
      }

      setStatus("保存中…");

      if (!bookId) {
        const { data, error } = await supabase
          .from("parari_books")
          .insert({ owner: user.id, title, content, is_public: false })
          .select("id,is_public")
          .single();

        if (error || !data) {
          setStatus("保存失敗: " + (error?.message ?? "no data"));
          return { ok: false, bookId: "" };
        }

        setBookId(data.id);
        setIsPublic(!!data.is_public);
        setStatus("保存しました");
        return { ok: true, bookId: data.id };
      } else {
        const { error } = await supabase.from("parari_books").update({ title, content }).eq("id", bookId);
        if (error) {
          setStatus("更新失敗: " + error.message);
          return { ok: false, bookId };
        }
        setStatus("更新しました");
        return { ok: true, bookId };
      }
    },
    [bookId]
  );

  const publish = useCallback(async (): Promise<OpResult> => {
    const id = bookId ?? "";
    if (!id) {
      setStatus("先に保存してください");
      return { ok: false, bookId: "" };
    }

    setStatus("公開中…");
    const { error } = await supabase.from("parari_books").update({ is_public: true }).eq("id", id);

    if (error) {
      setStatus("公開失敗: " + error.message);
      return { ok: false, bookId: id };
    }

    setIsPublic(true);
    setStatus("公開しました");
    return { ok: true, bookId: id };
  }, [bookId]);

  return {
    bookId,
    isPublic,
    status,
    setStatusExternal,
    save,
    publish,
    resetToNew,
  };
}
