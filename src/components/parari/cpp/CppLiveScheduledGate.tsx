"use client";
import CppLiveSchedule from "./CppLiveSchedule";

export default function CppLiveScheduledGate() {
  return <main className="min-h-screen bg-neutral-50 pt-16">
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <h1 className="text-2xl font-bold">CPP MATCHING · LIVE</h1>
      <p className="mt-2 text-sm text-neutral-600">
        開催予定はいつでも確認できます。開催時間中は対象者だけが専用会場へ進めます。
      </p>
    </div>
    <CppLiveSchedule />
  </main>;
}
