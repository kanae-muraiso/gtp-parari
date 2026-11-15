"use client";
import { useEffect, useState, type FormEvent } from "react";
import ClassIntakeForm, { type Intake } from "@/components/parari/classes/ClassIntakeForm";
import { useParams } from "next/navigation";

export default function ClassIntakePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Intake | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const path = "/api/classes/intake?id=" + encodeURIComponent(id);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(path, { signal: controller.signal }).then(response => response.json()).then(result => {
      if (!result.ok) throw new Error(result.message);
      setData(result);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [path]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(new FormData(event.currentTarget)), agree: true, information: data?.information }) });
      const result = await response.json();
      if (!result.ok) throw new Error(result.message);
      setDone(result.confirmation ? "予約を受け付けました。確認メールをご覧ください。" : "予約を受け付けました。確認メールを送信できなかったため、日時をお控えください。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "予約できませんでした。"); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-xl space-y-4 px-4 py-10">
    {data && <ClassIntakeForm data={data} busy={busy} done={done} submit={submit} />}
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">受付を読み込んでいます…</p>}
  </main>;
}
