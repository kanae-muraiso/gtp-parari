// apps/tools/parari/src/components/parari/panels/application/ApplicationPanelEditor.tsx
// 2026-06-25 JST
// PART: APPLICATION Panel editor v0
// コメント:
// - PanelDefinitionのPanelEditorPropsに合わせる
// - v0ではapplicationId参照だけ編集する
// - 募集本体編集UIは後続でDB/API側へ寄せる

"use client";

import React from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import type { ApplicationPanelData } from "./applicationTypes";
import { serializeApplicationPanel } from "./serializeApplicationPanel";

export default function ApplicationPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<ApplicationPanelData>) {
  const [applicationId, setApplicationId] = React.useState(
    data.applicationId ?? "",
  );

  React.useEffect(() => {
    setApplicationId(data.applicationId ?? "");
  }, [data.applicationId]);

  function commit(nextApplicationId: string) {
    const nextData: ApplicationPanelData = {
      applicationId: nextApplicationId.trim() || null,
    };

    onChangeRaw?.(serializeApplicationPanel(nextData));
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
        APPLICATION
      </div>

      <div className="mt-3 space-y-2">
        <label className="block text-xs text-neutral-600">
          applicationId
        </label>

        <input
          value={applicationId}
          onChange={(event) => setApplicationId(event.target.value)}
          onBlur={() => commit(applicationId)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
        />

        <p className="text-xs leading-relaxed text-neutral-500">
          APPLICATION本体はDB側で管理します。SSOTには参照IDだけを保存します。
        </p>

        <button
          type="button"
          onClick={() => commit(applicationId)}
          className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs text-amber-800 hover:bg-amber-100"
        >
          APPLICATION IDを保存
        </button>
      </div>
    </div>
  );
}
