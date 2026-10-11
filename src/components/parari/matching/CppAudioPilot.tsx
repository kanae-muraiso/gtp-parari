"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

/**
 * Isolated Preview-stage media test screen. The original CPP LIVE
 * matchmaking and text UI are untouched.
 */
export default function CppAudioPilot({ threadId }: { threadId: string }) {
  const [status, setStatus] = useState<"idle" | "connecting" | "active" | "ended" | "error">("idle");
  const [message, setMessage] = useState("");
  const [frameUrl, setFrameUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const frameRef = useRef<HTMLIFrameElement>(null);
  const remaining = Math.max(0, Math.ceil((expiresAt - clock) / 1000));

  useEffect(() => {
    if (status !== "active") return;
    const timer = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status === "active" && expiresAt > 0 && remaining === 0) {
      setFrameUrl("");
      setStatus("ended");
      setMessage("CPP LIVEの10分間が終了しました。");
    }
  }, [remaining, expiresAt, status]);

  useEffect(() => {
    return () => {
      // Browser unmount removes the Daily embed.
      if (frameRef.current) frameRef.current.src = "about:blank";
    };
  }, []);

  async function start() {
    if (!supabase || status === "connecting") return;
    setStatus("connecting");
    setMessage("");
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.access_token) throw new Error("ログインしてください。");
      const res = await fetch("/api/parari/live/cpp/audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ threadId }),
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 410) throw new Error("この10分間の会話は終了しています。");
        throw new Error("通話を開始できませんでした。会話の参加資格をご確認ください。");
      }
      const result = await res.json() as {
        roomUrl: string;
        token: string;
        sessionExpiresAt: string;
      };
      const url = new URL(result.roomUrl);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".daily.co")) {
        throw new Error("通話URLを確認できませんでした。");
      }
      const deadline = Date.parse(result.sessionExpiresAt);
      if (!Number.isFinite(deadline) || deadline <= Date.now()) {
        throw new Error("会話の終了時間を過ぎています。");
      }
      // Daily Prebuilt provides mic/audio controls for this pilot. Later
      // replace the iframe with the shared custom SDK component.
      url.searchParams.set("t", result.token);
      setExpiresAt(deadline);
      setClock(Date.now());
      setFrameUrl(url.toString());
      setStatus("active");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "通話を開始できませんでした。");
    }
  }

  function leave() {
    setFrameUrl("");
    setStatus("ended");
    setMessage("通話から退出しました。CPPの残り時間はリセットされません。");
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">CPP LIVE 音声テスト</h1>
      <p className="mt-2 text-sm text-neutral-600">既存のLIVEテキストチャットとは独立した、音声接続のテスト画面です。</p>
      {status === "active" && (
        <p aria-live="polite" className="mt-4 font-semibold">
          残り {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </p>
      )}
      {frameUrl && remaining > 0 && (
        <iframe
          ref={frameRef}
          title="CPP LIVE 音声通話"
          src={frameUrl}
          allow="microphone; camera; autoplay"
          className="mt-4 h-[540px] w-full rounded-xl border border-neutral-200"
        />
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {(status === "idle" || status === "error") && (
          <button type="button" disabled={status === "connecting"} onClick={() => void start()}
            className="rounded-full bg-neutral-900 px-5 py-3 text-white">音声通話を始める</button>
        )}
        {status === "active" && (
          <button type="button" onClick={leave}
            className="rounded-full bg-red-700 px-5 py-3 text-white">通話を終了する</button>
        )}
        <Link href="/my/cpp/live" className="rounded-full border px-5 py-3">CPP LIVEに戻る</Link>
      </div>
      {status === "connecting" && <p className="mt-3">安全な通話ルームに接続しています…</p>}
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
      <p className="mt-6 text-xs text-neutral-500">
        テスト段階のため、既存のCPP LIVE会話を開始している2人だけが利用できます。
        通信の再接続やページ更新では10分の期限は延長されません。
      </p>
    </main>
  );
}
