"use client";
// 2026-10-14 JST / PART: Muted video tiles and one separate audio sink per remote track.
import { useEffect, useRef } from "react";
import type { DailyParticipant, DailyTrackState } from "@daily-co/daily-js";
import { stageRoleLabels, type StagePerson } from "@/lib/parari/live/stageLayout";
export function StageVideo({ track, mirror = false, screen = false }: { track?: DailyTrackState; mirror?: boolean; screen?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const media = track?.persistentTrack ?? track?.track;
  useEffect(() => {
    const el = ref.current; if (!el || !media) return;
    el.srcObject = new MediaStream([media]); void el.play().catch(() => {});
    return () => { el.srcObject = null; };
  }, [media]);
  return <video ref={ref} autoPlay playsInline muted aria-label={screen ? "共有画面" : "参加者の映像"}
    className={`h-full w-full ${screen ? "object-contain" : "object-cover"} ${mirror ? "-scale-x-100" : ""} ${track?.state === "playable" ? "" : "invisible"}`} />;
}
export function StageAudio({ track, replay, onBlocked }: { track?: DailyTrackState; replay: number; onBlocked: () => void }) {
  const ref = useRef<HTMLAudioElement>(null); const media = track?.persistentTrack ?? track?.track;
  useEffect(() => {
    const el = ref.current; if (!el || !media) return;
    let active = true; el.srcObject = new MediaStream([media]);
    void el.play().catch(() => { if (active) onBlocked(); });
    return () => { active = false; el.srcObject = null; };
  }, [media, replay, onBlocked]);
  return <audio ref={ref} autoPlay />;
}
export function StageTile({ person, participant, selected, onSelect, placeholder = "登壇枠" }: {
  person?: StagePerson; participant?: DailyParticipant; selected?: boolean; onSelect?: (id: string) => void; placeholder?: string;
}) {
  const question = person?.role === "questioner";
  const contents = <>
    <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-300">{person ? (participant ? "カメラOFF" : "未接続") : placeholder}</div>
    {participant && <StageVideo track={participant.tracks.video} mirror={participant.local} />}
    {person && <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-1 text-left text-xs text-white">
      <span className="block truncate">{person.hand_raised ? "✋ " : ""}{person.display_name}</span>
      <span className={question ? "font-bold text-red-200" : "text-neutral-300"}>{stageRoleLabels[person.role]}{participant?.tracks.audio.state === "playable" ? " · マイクON" : ""}</span>
    </div>}
  </>;
  const style = `relative aspect-video min-w-0 overflow-hidden rounded-lg bg-neutral-800 ${question ? "border-4 border-red-600" : selected ? "ring-4 ring-indigo-500" : "border border-neutral-600"}`;
  return person && onSelect ? <button type="button" className={style} onClick={() => onSelect(person.user_id)}
    aria-label={`${person.display_name}を選択`} aria-pressed={selected} data-role={person.role}>{contents}</button>
    : <div className={style} data-role={person?.role ?? "empty"}>{contents}</div>;
}
