"use client";
// 2026-10-14 JST / PART: Choose a background while the camera is off.
import type { StageBackground } from "@/lib/parari/live/stageCamera";
import type { DailyParticipant } from "@daily-co/daily-js";
import { StageVideo } from "./CppLiveStageTiles";

export default function CppLiveStageBackground({ value, supported, busy, local, onChange }: {
  value: StageBackground; supported: boolean; busy: boolean; local?: DailyParticipant; onChange: (value: StageBackground) => void;
}) {
  return <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3" aria-label="自分の背景設定">
    <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">カメラの背景
      <select aria-label="カメラの背景" value={value} onChange={event => onChange(event.target.value as StageBackground)} className="rounded border bg-white px-3 py-2 font-normal">
        <option value="blur" disabled={!supported}>背景をぼかす</option>
        <option value="sand" disabled={!supported}>背景画像：ベージュ</option>
        <option value="blue" disabled={!supported}>背景画像：ブルー</option>
        <option value="none">背景なし（部屋が映ります）</option>
      </select>
      {(value === "sand" || value === "blue") && <span aria-hidden="true" className="h-8 w-14 rounded border" style={{ background: value === "sand" ? "linear-gradient(135deg, #f3eadc, #bfa98a)" : "linear-gradient(135deg, #dce9f3, #879fbf)" }} />}
    </label>
    <p className="text-xs text-neutral-600">背景を選んでから「カメラをON」を押してください。背景を変更するとカメラはOFFになります。</p>
    {!supported && <p className="text-sm text-amber-800">この端末では背景加工を使えません。カメラOFFのまま参加できます。「背景なし」を選ぶと、部屋が映る状態でカメラをONにできます。</p>}
    {busy && <p role="status" className="text-sm text-indigo-700">背景を準備しています… カメラはOFFです。</p>}
    {local?.video && <div className="max-w-60 space-y-1" aria-label="自分の送信映像">
      <div className="aspect-video overflow-hidden rounded-lg bg-neutral-800"><StageVideo track={local.tracks.video} mirror /></div>
      <p className="text-xs text-neutral-600">自分の映像です。カメラON中は参加者にも届きます。</p>
    </div>}
  </div>;
}
