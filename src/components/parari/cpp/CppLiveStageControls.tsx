"use client";
// 2026-10-14 JST / PART: Speaker assignment and Q&A are intentionally separate host actions.
import { stageRoleLabels, type StageState } from "@/lib/parari/live/stageLayout";
export type StageAction = "panel_add" | "panel_remove" | "question_allow" | "question_end" | "lecture" | "panel" | "host_visibility" | "retry";
export default function CppLiveStageControls({ state, target, setTarget, busy, act }: {
  state: StageState; target: string; setTarget: (id: string) => void; busy: boolean;
  act: (action: StageAction, targetId?: string, visible?: boolean) => void;
}) {
  const person = state.people.find(p => p.user_id === target);
  const disabled = busy || state.closing || !state.room_id;
  const panelists = state.people.filter(p => p.role === "host" || p.role === "presenter").sort((a,b) => (a.panel_slot ?? 0) - (b.panel_slot ?? 0));
  const hands = state.people.filter(p => p.hand_raised);
  const button = "rounded-lg border px-3 py-2 text-sm disabled:opacity-40";
  return <div className="space-y-4 border-t pt-4" aria-label="司会者の登壇操作">
    {state.pending_count > 0 && <button type="button" className={button} disabled={disabled} onClick={() => act("retry")}>接続権限の切替を再試行</button>}
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-sm">操作する参加者 <select aria-label="操作する参加者" value={target} onChange={e => setTarget(e.target.value)} className="max-w-full rounded border p-2">
        <option value="">映像または名簿から選択</option>{state.people.map(p => <option key={p.user_id} value={p.user_id}>{p.display_name}（{stageRoleLabels[p.role]}{p.present ? "" : "・退室中"}）</option>)}
      </select></label>
      <button type="button" className={button} disabled={disabled} onClick={() => act("host_visibility", undefined, !state.host_visible)}>{state.host_visible ? "司会の映像枠を隠す" : "司会の映像枠を表示"}</button>
    </div>
    <fieldset className="space-y-2 rounded-lg bg-indigo-50 p-3"><legend className="font-semibold">登壇・講演の切り替え</legend>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={disabled || !person || !person.present || person.role === "host" || person.role === "presenter" || panelists.length >= 7} onClick={() => act("panel_add", target)}>パネルに追加</button>
        <button type="button" className={button} disabled={disabled || person?.role !== "presenter"} onClick={() => act("panel_remove", target)}>パネルから外す</button>
        <button type="button" className={button} disabled={disabled || !person || !["host", "presenter"].includes(person.role)} onClick={() => act("lecture", target)}>この人の講演に切り替え</button>
        <button type="button" className={button} disabled={disabled || state.display_mode === "panel"} onClick={() => act("panel")}>パネルに戻す</button>
      </div>
      <p className="text-xs">司会＋6人まで。交代する場合は外してから追加します。講演中もパネルの名簿を保持します。</p>
      <p className="text-sm">登壇中：{panelists.map(p => p.display_name).join("、")}</p>
    </fieldset>
    <fieldset className="space-y-2 rounded-lg bg-red-50 p-3"><legend className="font-semibold">質問の許可</legend>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={disabled || !person || !person.present || person.role !== "viewer"} onClick={() => act("question_allow", target)}>質問を許可</button>
        <button type="button" className={button} disabled={disabled || !state.people.some(p => p.role === "questioner")} onClick={() => act("question_end")}>質問を終了</button>
      </div>
      <p className="text-xs">質問者は1人。別の人を許可すると交代し、登壇枠の下の左端に赤枠で表示します。</p>
      <div aria-label="挙手一覧" className="flex flex-wrap items-center gap-2"><span className="text-sm">挙手 {hands.length}人（挙手順）</span>{hands.map((p, i) => <button type="button" key={p.user_id} className={button} onClick={() => setTarget(p.user_id)}>{i + 1}. ✋ {p.display_name}</button>)}</div>
    </fieldset>
    <p className="text-xs text-neutral-600">発言権限が変わった方は、接続し直してからご自身でマイクをONにしてください。司会の映像枠を隠しても、司会のマイクと操作権限は維持されます。</p>
  </div>;
}
