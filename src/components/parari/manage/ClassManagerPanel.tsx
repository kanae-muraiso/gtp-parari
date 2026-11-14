"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import ClassAdmissionsPanel from "./ClassAdmissionsPanel";
import { classRequest, ClassRequestError } from "@/lib/classRequests";
import { type ClassManagement, type ClassRosterMember } from "@/lib/classes";
import { useParticipations } from "@/components/parari/navigation/ParticipationProvider";

const field = "block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2";
const label = "grid gap-1 text-sm font-medium";
const panel = "grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5";
const button = "w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const managePath = "/my/manage?tab=class";

function formValues(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget));
}

export default function ClassManagerPanel() {
  const [view, setView] = useState<"admissions" | "settings" | "roster">("admissions");
  const [data, setData] = useState<ClassManagement | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const { userId } = useParticipations();

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    setNeedsLogin(false);
    void classRequest<ClassManagement>("", undefined, controller.signal).then(result => {
      if (!controller.signal.aborted) {
        setData(result);
      }
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "教室を取得できませんでした。");
      setNeedsLogin(cause instanceof ClassRequestError && cause.status === 401);
    });
    return () => controller.abort();
  }, [userId]);

  async function save(body: object, success: string) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      setData(await classRequest<ClassManagement>("", body));
      setMessage(success);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できませんでした。");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!data || data.userId !== userId) {
    return <div className={panel}>
      <p role={error ? "alert" : "status"}>{error || "教室を読み込んでいます…"}</p>
      {needsLogin && <Link className="underline" href={`/login?returnTo=${encodeURIComponent(managePath)}`}>ログイン</Link>}
    </div>;
  }
  const school = data.school;
  const item = school?.classes[0];
  const currentAdmissionMissing = data.applicationId && !data.applications.some(application => application.id === data.applicationId);

  return <div className="grid gap-5">
    <h2 className="text-xl font-bold">CLASS A</h2>
    {school && <nav aria-label="クラス運営" className="flex flex-wrap gap-2">
      {([["admissions", "入会手続き"], ["settings", "入会設定"], ["roster", "名簿・クラス"]] as const).map(([key, title]) =>
        <button key={key} type="button" aria-pressed={view === key} onClick={() => { setView(key); setMessage(""); setError(""); }}
          className={view === key ? button : "rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm"}>{title}</button>)}
    </nav>}
    {(!school || view === "roster") && <form key={school?.id ?? "new"} className={panel} onSubmit={event => {
      const values = formValues(event);
      void save({ ...values, action: school ? "schedule" : "create" }, school ? "クラスの情報を保存しました。" : "教室を開設しました。");
    }}>
      <h3 className="font-bold">{school ? "教室・定期クラス" : "教室を開設"}</h3>
      <label className={label}>教室名<input className={field} name="schoolName" required maxLength={120} defaultValue={school?.name} /></label>
      <label className={label}>クラス名<input className={field} name="name" required maxLength={120} defaultValue={item?.name} /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>頻度<select className={field} name="cadence" defaultValue={item?.cadence ?? "weekly"}>
          <option value="weekly">毎週</option><option value="monthly">毎月</option>
        </select></label>
        <label className={label}>初回日<input className={field} type="date" name="date" required defaultValue={item?.starts_on} /></label>
        <label className={label}>開始時刻（日本時間）<input className={field} type="time" name="time" required defaultValue={item?.starts_at.slice(0, 5)} /></label>
      </div>
      <label className={label}>会場<input className={field} name="location" maxLength={200} defaultValue={item?.location ?? ""} /></label>
      <div className="flex flex-wrap items-center gap-4">
        <button className={button} disabled={busy}>{school ? "保存" : "開設する"}</button>
        {school && <Link className="text-sm underline" href={`/my/classes/${school.id}`}>受講者ページを開く</Link>}
      </div>
    </form>}
    {school && <>
      {view !== "roster" && <ClassAdmissionsPanel key={school.id + view} mode={view} onRosterChanged={() => {
        void classRequest<ClassManagement>().then(setData).catch(() => setError("名簿を再読み込みしてください。"));
      }} />}
      {view === "settings" && <form key={data.applicationId ?? "unlinked"} className={panel} onSubmit={event => {
        const values = formValues(event);
        void save({ action: "admission", applicationId: values.applicationId || null }, "入会受付の設定を保存しました。");
      }}>
        <h3 className="font-bold">既存のAPPLICATIONとの接続</h3>
        <label className={label}>APPLICATIONの「継続クラス」
          <select className={field} name="applicationId" defaultValue={data.applicationId ?? ""}>
            <option value="">入会受付を接続しない</option>
            {currentAdmissionMissing && <option value={data.applicationId ?? ""} disabled>現在の受付は終了・保管済みです</option>}
            {data.applications.map(application => <option key={application.id} value={application.id}>{application.title}</option>)}
          </select>
        </label>
        <p className="text-sm text-neutral-600">選んだ受付で確定した申込を名簿に登録します。過去に確定した申込も対象です。</p>
        <button className={button} disabled={busy}>受付設定を保存</button>
      </form>}
      {view === "roster" && <section className={panel} aria-labelledby="class-roster-heading">
        <h3 id="class-roster-heading" className="font-bold">名簿（在籍 {data.roster.filter(member => member.status === "active").length}名）</h3>
        <form className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={async event => {
          const form = event.currentTarget;
          const values = formValues(event);
          const requestId = memberId ?? crypto.randomUUID();
          setMemberId(requestId);
          if (await save({ ...values, action: "add", memberId: requestId }, "名簿に登録しました。")) {
            setMemberId(null);
            form.reset();
          }
        }}>
          <label className={label}>受講者名<input className={field} name="name" required maxLength={120} /></label>
          <label className={label}>PARARIユーザー名（任意）<input className={field} name="username" maxLength={120} /></label>
          <button className={button} disabled={busy}>追加</button>
        </form>
        {data.roster.length === 0 && <p className="text-sm text-neutral-600">名簿に登録された受講者はいません。</p>}
        <ul className="divide-y divide-neutral-200">
          {data.roster.map(member => <li key={member.id} className="py-3"><RosterRow member={member} busy={busy} save={save} /></li>)}
        </ul>
      </section>}
    </>}
    <div aria-live="polite">
      {error && <p className="text-sm text-red-800" role="alert">{error}</p>}
      {message && <p className="text-sm text-emerald-900">{message}</p>}
    </div>
  </div>;
}

function RosterRow({ member, busy, save }: {
  member: ClassRosterMember;
  busy: boolean;
  save: (body: object, success: string) => Promise<boolean>;
}) {
  return <div className="grid gap-2">
    <form className="grid items-end gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={event => {
      const values = formValues(event);
      void save({ ...values, action: "member", memberId: member.id }, "受講者情報を保存しました。");
    }}>
      <label className={label}>受講者名<input className={field} defaultValue={member.name} name="name" maxLength={120} required /></label>
      <label className={label}>在籍状況<select className={field} name="status" defaultValue={member.status}>
        <option value="active">在籍</option><option value="ended">退会</option>
      </select></label>
      <button className={button} disabled={busy}>更新</button>
    </form>
    {!member.user_id && <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
      const values = formValues(event);
      void save({ ...values, action: "link", memberId: member.id }, "アカウントを連携しました。");
    }}>
      <label className={label}>連携するPARARIユーザー名<input className={field} name="username" maxLength={120} required /></label>
      <button className={button} disabled={busy}>連携</button>
    </form>}
  </div>;
}
