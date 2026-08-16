// apps/tools/parari/src/components/parari/panels/ApplicationModulePanel.tsx
// 2026-03-31 JST

"use client";

/**
 * PART: ApplicationModulePanel
 * コメント:
 * - APPLICATION 参照ノードの最小選択UI
 * - ローカル draft を持つ
 * - 確定で親へ反映
 * - キャンセルで元に戻す
 */

import React from "react";
import { supabase } from "../../../lib/supabaseClient";

type ApplicationRow = {
  id: string;
  title: string | null;
};

type Props = {
  enabled: boolean;
  applicationId: string;
  onCommit: (next: { enabled: boolean; applicationId: string }) => void;
  onCancel: () => void;
};

export default function ApplicationModulePanel({
  enabled,
  applicationId,
  onCommit,
  onCancel,
}: Props) {
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<ApplicationRow[]>([]);

  const [draftEnabled, setDraftEnabled] = React.useState(enabled);
  const [draftApplicationId, setDraftApplicationId] = React.useState(
    applicationId ?? ""
  );

  React.useEffect(() => {
    setDraftEnabled(enabled);
    setDraftApplicationId(applicationId ?? "");
  }, [enabled, applicationId]);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("parari_applications")
        .select("id, title")
        .eq("owner", userData.user.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error || !data) {
        setItems([]);
        setLoading(false);
        return;
      }

      setItems(data as ApplicationRow[]);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-2xl border p-4">
      <div className="text-sm font-medium">Application</div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draftEnabled}
          onChange={(e) => setDraftEnabled(e.target.checked)}
        />
        募集広告を使う
      </label>

      <div className="mt-3">
        <select
          value={draftApplicationId}
          onChange={(e) => setDraftApplicationId(e.target.value)}
          disabled={!draftEnabled || loading}
          className="w-full rounded-xl border px-3 py-2 text-sm"
        >
          <option value="">
            {loading ? "読み込み中…" : "募集広告を選択"}
          </option>

          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title?.trim() || item.id}
            </option>
          ))}
        </select>
      </div>

      {draftEnabled && draftApplicationId ? (
        <div className="mt-3 text-xs text-neutral-500 break-all">
          applicationId: {draftApplicationId}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            onCommit({
              enabled: draftEnabled,
              applicationId: draftApplicationId.trim(),
            });
          }}
          className="rounded-xl bg-black px-4 py-2 text-sm text-white"
        >
          確定して閉じる
        </button>

        <button
          type="button"
          onClick={() => {
            setDraftEnabled(enabled);
            setDraftApplicationId(applicationId ?? "");
            onCancel();
          }}
          className="rounded-xl border px-4 py-2 text-sm"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
