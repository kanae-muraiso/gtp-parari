// src/components/parari/cpp/CppAiChat.tsx
// 2026-10-09 JST — PART: Session-only CPP AI dialogue
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CPP_AI_LIMITS, CPP_AI_PREPARING, type CppAiMessage, type CppAiStatus } from "@/lib/cpp/ai/contracts";

const starters = [
  "研究経験を、専門外の人にも伝わる言葉にしたいです。",
  "自分の強みについて、具体的な経験から考えたいです。",
  "最近の経験や関心の変化から、今後のキャリアを考えたいです。",
];

export default function CppAiChat({ userId, onIdentityChange }: { userId: string; onIdentityChange: (id: string | null) => void }) {
  const [status, setStatus] = useState<CppAiStatus | null>(null);
  const [messages, setMessages] = useState<CppAiMessage[]>([]);
  const [input, setInput] = useState("");
  const [useProfile, setUseProfile] = useState(true);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(), 15000);
    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session?.user.id !== userId) { onIdentityChange(data.session?.user.id ?? null); return; }
        const response = await fetch("/api/cpp/ai", { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: "no-store", signal: abort.signal });
        const result = await response.json();
        if (!active) return;
        if (response.status === 401) { onIdentityChange(null); return; }
        setStatus({ available: response.ok && result.available === true, message: result.message || CPP_AI_PREPARING, code: result.code });
      } catch {
        if (active) setStatus({ available: false, message: "利用状況を確認できませんでした。ページを再読み込みしてください。" });
      } finally { window.clearTimeout(timer); }
    };
    void load();
    return () => { active = false; window.clearTimeout(timer); abort.abort(); controller.current?.abort(); };
  }, [userId, onIdentityChange]);

  useEffect(() => { end.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" }); }, [messages, busy]);

  const total = messages.reduce((sum, message) => sum + message.content.length, 0) + input.trim().length;
  const atLimit = messages.length + 1 > CPP_AI_LIMITS.messages || total > CPP_AI_LIMITS.totalChars;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (pending.current || !content || !consent || !status?.available || atLimit) return;
    pending.current = true;
    setBusy(true); setError(""); setCopyNotice("");
    const abort = new AbortController();
    controller.current = abort;
    const timer = window.setTimeout(() => abort.abort(), 50000);
    const next: CppAiMessage[] = [...messages, { role: "user", content }];
    try {
      const { data } = await supabase.auth.getSession();
      if (abort.signal.aborted) return;
      if (data.session?.user.id !== userId) { onIdentityChange(data.session?.user.id ?? null); return; }
      const response = await fetch("/api/cpp/ai", {
        method: "POST", cache: "no-store", signal: abort.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ messages: next, useProfile, consent: true }),
      });
      const result = await response.json();
      if (abort.signal.aborted) return;
      if (response.status === 401) { onIdentityChange(null); return; }
      if (!response.ok || result.message?.role !== "assistant" || typeof result.message.content !== "string") {
        setError(typeof result.error === "string" ? result.error : "回答を取得できませんでした。もう一度お試しください。");
        return;
      }
      setMessages([...next, { role: "assistant", content: result.message.content }]);
      setInput("");
    } catch {
      setError("AIとの接続が中断されました。入力は残っています。時間をおいて再送してください。");
    } finally {
      window.clearTimeout(timer);
      pending.current = false; setBusy(false);
    }
  };

  const copyConversation = async () => {
    try {
      await navigator.clipboard.writeText(messages.map((m) => `${m.role === "user" ? "あなた" : "CPP AI"}\n${m.content}`).join("\n\n"));
      setCopyNotice("対話をコピーしました。手元のメモなどに保存できます。");
    } catch { setCopyNotice("コピーできませんでした。対話の文章を選択してコピーしてください。"); }
  };

  if (!status) return <p role="status" className="py-8 text-sm text-neutral-600">CPP AIの利用状況を確認しています…</p>;
  if (!status.available) return (
    <section className="mt-5 rounded-3xl border border-neutral-200 bg-white p-6">
      <h2 className="font-bold text-neutral-900">{status.code === "researcher_required" ? "研究者登録を確認してください" : "CPP AIのご案内"}</h2>
      <p role="status" className="mt-3 text-sm leading-7 text-neutral-600">{status.message}</p>
      {status.code === "researcher_required" ? <Link href="/cpp/try" className="mt-4 block text-sm font-bold underline">研究者登録へ</Link> : null}
    </section>
  );

  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-3xl border border-neutral-200 bg-white p-6 text-sm leading-7 text-neutral-600">
        <p>対話はこの画面を開いている間だけ保持します。再読み込み・画面移動・ログアウトで消えるため、必要な内容はコピーしてください。プロフィールへの反映は、内容を確かめて編集画面で行えます。</p>
        <label className="mt-4 flex items-start gap-3 text-neutral-900">
          <input type="checkbox" checked={useProfile} disabled={busy || messages.length > 0} onChange={(e) => setUseProfile(e.target.checked)} className="mt-2 h-4 w-4 shrink-0" />
          <span>保存済みプロフィールを参照する<br /><span className="text-xs text-neutral-500">学位・所属・立場・キーワード・学歴職歴・研究概要・自己アピールの一部を参照します。連絡先欄・写真・添付PDF・論文リストは参照しません。</span></span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-neutral-900">
          <input type="checkbox" checked={consent} disabled={busy} onChange={(e) => setConsent(e.target.checked)} className="mt-2 h-4 w-4 shrink-0" />
          <span>入力した文章と、参照を選んだプロフィール情報をOpenAIに送信することに同意します。<br /><span className="text-xs text-neutral-500">自由記述に含まれる情報も送信されます。未公開研究や第三者の秘密は入力しないでください。</span></span>
        </label>
      </section>

      {!messages.length ? <div className="flex flex-col gap-2" aria-label="対話のきっかけ">{starters.map((starter) => (
        <button key={starter} type="button" disabled={busy} onClick={() => setInput(starter)} className="rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-left text-sm text-neutral-700 hover:border-neutral-500">{starter}</button>
      ))}</div> : null}

      <section aria-label="CPP AIとの対話" aria-live="polite" aria-relevant="additions" className="space-y-4">
        {messages.map((message, index) => <article key={index} className={`rounded-3xl border p-5 sm:p-6 ${message.role === "user" ? "ml-5 border-blue-100 bg-blue-50" : "mr-5 border-neutral-200 bg-white"}`}>
          <h2 className="mb-2 text-xs font-bold text-neutral-500">{message.role === "user" ? "あなた" : "CPP AI"}</h2>
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-neutral-900">{message.content}</p>
        </article>)}
        {busy ? <p role="status" className="px-5 py-3 text-sm text-neutral-600">経験と言葉を整理しています…</p> : null}
        <div ref={end} />
      </section>

      {messages.length ? <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => void copyConversation()} className="text-sm font-bold text-neutral-700 underline">対話をコピー</button>
        <button type="button" disabled={busy} onClick={() => {
          if (!window.confirm("この画面の対話と入力を消して、新しく始めますか？必要な内容は先にコピーしてください。")) return;
          setMessages([]); setInput(""); setError(""); setCopyNotice(""); setConsent(false);
        }} className="text-sm text-neutral-600 underline disabled:opacity-50">対話を消して新しく始める</button>
        <p role="status" className="w-full text-xs text-neutral-600">{copyNotice}</p>
      </div> : null}

      <form onSubmit={(event) => void submit(event)} className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6">
        <label htmlFor="cpp-ai-input" className="text-sm font-bold text-neutral-900">話してみたいこと</label>
        <textarea id="cpp-ai-input" value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} maxLength={CPP_AI_LIMITS.userChars} rows={5} aria-describedby="cpp-ai-input-help" placeholder="最近取り組んだ研究や、気になっていることから始めてください。" className="mt-3 w-full rounded-2xl border border-neutral-300 bg-white p-4 text-sm leading-7 text-neutral-900 focus:border-neutral-600 disabled:opacity-60" />
        <p id="cpp-ai-input-help" className="mt-1 text-xs text-neutral-500">{input.length} / {CPP_AI_LIMITS.userChars}文字</p>
        {atLimit ? <p role="status" className="mt-3 text-sm text-amber-800">この対話の上限に近づきました。入力を短くするか、対話をコピーして新しく始めてください。</p> : null}
        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs leading-5 text-neutral-500">AIの提案は下書きです。事実とご自身の考えを確認して使ってください。</p>
          <button type="submit" disabled={busy || !consent || !input.trim() || atLimit} className="shrink-0 rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? "考え中…" : "送信する"}</button>
        </div>
      </form>
    </div>
  );
}
