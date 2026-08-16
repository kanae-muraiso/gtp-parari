// apps/tools/parari/src/components/parari/panels/membership/MembershipPanelEditor.tsx
// 2026-08-13 JST
// PART: MEMBERSHIP Panel editor
//
// コメント:
// - MVPでは recruitmentId を直接指定する
// - Membership管理画面完成後は「入会窓口を選択」に置き換える予定

"use client";

import * as React from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import type { MembershipPanelData } from "./membershipTypes";
import { serializeMembershipPanel } from "./serializeMembershipPanel";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export default function MembershipPanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<MembershipPanelData>) {
  const [recruitmentId, setRecruitmentId] = React.useState(
    data.recruitmentId ?? "",
  );

  const [errorMessage, setErrorMessage] = React.useState("");

  React.useEffect(() => {
    setRecruitmentId(data.recruitmentId ?? "");
  }, [data.recruitmentId]);

  function commit(nextRecruitmentId: string) {
    const normalized = nextRecruitmentId.trim();

    if (normalized && !UUID_RE.test(normalized)) {
      setErrorMessage(
        "recruitmentId はUUID形式で入力してください。",
      );
      return;
    }

    setErrorMessage("");

    const nextData: MembershipPanelData = {
      recruitmentId: normalized || null,
    };

    onChangeRaw?.(
      serializeMembershipPanel(nextData),
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          MEMBERSHIP
        </div>

        <div className="mt-1 text-sm font-semibold text-neutral-900">
          会員登録パネル
        </div>

        <p className="mt-1 text-xs leading-5 text-neutral-600">
          このパネルから、指定したMembershipへの会員登録を受け付けます。
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-neutral-700">
          入会窓口ID（recruitmentId）
        </span>

        <input
          value={recruitmentId}
          onChange={(event) => {
            setRecruitmentId(event.target.value);
            setErrorMessage("");
          }}
          onBlur={() => commit(recruitmentId)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(recruitmentId);
              event.currentTarget.blur();
            }
          }}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          spellCheck={false}
          className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 font-mono text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        />
      </label>

      {errorMessage ? (
        <p className="mt-2 text-xs font-medium text-red-600">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-4 rounded-xl border border-emerald-100 bg-white/70 px-3 py-2 text-xs leading-5 text-neutral-500">
        現在は入会窓口IDを直接指定します。
        Membership管理画面完成後は、登録済みの入会窓口から選択できるようにします。
      </div>
    </div>
  );
}
