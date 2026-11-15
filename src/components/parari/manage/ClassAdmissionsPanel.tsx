"use client";
import { applicationFields, type ApplicationField } from "@/lib/classBriefingWorkflow";

import { useEffect, useState, type FormEvent } from "react";
import { classRequest } from "@/lib/classRequests";
import { type AdmissionsData, type AdmissionCase } from "@/lib/classAdmissions";

const panel = "grid gap-3 rounded-2xl border border-neutral-200 bg-white p-5";
const field = "block w-full rounded border border-neutral-300 p-2 text-sm";
const button = "w-fit rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50";
const path = "/admissions";
const options = {
  briefing: { pending: "日時未定", booked: "予約済み", done: "参加済み", missed: "欠席", skip: "省略" },
  test: { pending: "日時未定", booked: "予約済み", taken: "受験済み", graded: "採点済み", skip: "省略" },
  decision: { pending: "確認待ち", approved: "案内可", held: "保留", rejected: "不合格", waitlist: "空き待ち", withdrawn: "辞退" },
  payment: { free: "無料", advance: "事前払い", onsite: "当日払い" },
  source: { public: "公開募集", referral: "紹介", invite: "先生からの招待" },
};

function Select({ name, label, values, initial }: { name: string; label: string; values: Record<string, string>; initial?: string }) {
  return <label className="text-sm">{label}<select className={field} name={name} defaultValue={initial}>
    {Object.entries(values).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
  </select></label>;
}

export default function ClassAdmissionsPanel({ mode, onRosterChanged }: { mode: "settings" | "admissions" | "labels"; onRosterChanged?: () => void }) {
  const [data, setData] = useState<AdmissionsData | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void classRequest<AdmissionsData>(mode === "admissions" ? path : path + "?settings=1", undefined, controller.signal).then(setData).catch(cause => {
      if (!controller.signal.aborted) setError(cause.message);
    });
    return () => controller.abort();
  }, [generation, mode]);

  async function save(action: string, values: object) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await classRequest<{ mailed?: boolean }>(path, { action, ...values });
      setData(await classRequest<AdmissionsData>(mode === "admissions" ? path : path + "?settings=1"));
      if (action === "finish") onRosterChanged?.();
      setMessage(result.mailed === false ? "案内リンクを作成しました。メールを送信できなかったため、リンクをコピーしてお渡しください。"
        : result.mailed || action === "email" ? "メールを送信しました。" : "保存しました。");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できませんでした。");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <section className={panel}><p role={error ? "alert" : "status"}>{error || "入会の工程を読み込んでいます…"}</p>
    {error && <button className={button} onClick={() => { setError(""); setGeneration(value => value + 1); }}>再読み込み</button>}</section>;

  const { settings, cases } = data;
  const { labels } = settings;
  if (mode === "labels") return <section className={panel}>
    <h3 className="font-bold">呼び方</h3>
    <form onSubmit={event => {
      event.preventDefault();
      void save("labels", { labels: Object.fromEntries(new FormData(event.currentTarget)) });
    }}>
      <fieldset className="grid gap-2" disabled={busy}>
          {Object.entries({ operator: "運営者の呼び方", learner: "参加する人の呼び方", proxy: "代理申込者の呼び方", admission: "手続きの呼び方" }).map(([key, title]) =>
            <label key={key} className="text-sm">{title}<input className={field} name={key} defaultValue={labels[key as keyof typeof labels]} maxLength={24} required /></label>)}
        <button className={button}>呼び方を保存</button>
      </fieldset>
    </form>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
  </section>;

  const candidate = cases.find(row => row.id === selected);
  return <section className={panel}>
    <h3 className="font-bold">{labels.admission}{mode === "settings" ? "設定" : "手続き"}</h3>
    {mode === "settings" ? <>
      <form className="mt-3 grid gap-2" onSubmit={event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void save("settings", { terms: form.get("terms"), briefing: settings.briefing, test: form.has("test"), proxy: form.has("usesProxy") });
      }}>
        <fieldset className="grid gap-2" disabled={busy}>
          <label className="text-sm"><input type="checkbox" name="test" defaultChecked={settings.test} /> テストを使う</label>
          <label className="text-sm"><input type="checkbox" name="usesProxy" defaultChecked={settings.proxy} /> 代理申込者の連絡先を使う</label>
          <label className="text-sm">同意する規約<textarea className={field} name="terms" rows={3} maxLength={8000} defaultValue={settings.terms} /></label>
          <button className={button}>設定を保存</button>
        </fieldset>
      </form>
      <p className="text-sm text-neutral-600">候補者登録 → {settings.test ? "テスト・採点 → " : ""}{labels.operator}の確認 → 同意・支払い → 名簿登録</p>
    </> : <>
    <form className="grid gap-2" onSubmit={async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const id = form.dataset.requestId || crypto.randomUUID();
      form.dataset.requestId = id;
      if (await save("create", { ...Object.fromEntries(new FormData(form)), id })) {
        delete form.dataset.requestId;
        form.reset();
        setSelected(id);
      }
    }}>
      <fieldset className="grid gap-2" disabled={busy}>
        <label className="text-sm">{labels.learner}の名前<input className={field} name="name" maxLength={120} required /></label>
        <label className="text-sm">{settings.proxy ? labels.proxy : labels.learner}の連絡先<input className={field} name="contact" maxLength={300} /></label>
        <Select name="source" label="受付経路" values={options.source} />
        <button className={button}>候補者を追加</button>
      </fieldset>
    </form>
    <label className="text-sm">候補者<select className={field} value={selected} onChange={event => setSelected(event.target.value)}>
      <option value="">選択してください</option>
      {cases.map(row => <option key={row.id} value={row.id}>{row.name} · {row.enrollment_id ? "在籍登録済み" : options.decision[row.decision]}{row.briefing_at && " · " + toJapanTime(row.briefing_at)}</option>)}
    </select></label>
    {candidate && <Candidate key={candidate.id + ":" + candidate.revision} candidate={candidate} data={data} busy={busy} save={save} />}
    </>}
    {error && <p role="alert" className="text-sm text-red-800">{error} <button className="underline" type="button" onClick={() => { setError(""); setGeneration(value => value + 1); }}>再読み込み</button></p>}
    {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
  </section>;
}

const toJapanTime = (value: string) => new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

function Candidate({ candidate: row, data, busy, save }: {
  candidate: AdmissionCase; data: AdmissionsData; busy: boolean; save: (action: string, values: object) => Promise<boolean>;
}) {
  const [correction, setCorrection] = useState(false);
  const { labels, terms } = data.settings;
  if (row.enrollment_id) return <div className="grid gap-2"><p>名簿に登録済みです。</p>
    {row.applicant_email && <MailForm title="初回の日程をメールで案内" busy={busy} onSend={instructions => save("email", { id: row.id, kind: "start", instructions })} />}
  </div>;
  const showBriefing = row.briefing !== "skip" || correction;
  const showTest = row.test !== "skip" || correction;
  const agreed = row.consent_at && row.agreed_terms === terms;
  const toTimestamp = (value: FormDataEntryValue | null) => value ? String(value) + ":00+09:00" : null;
  const toLocal = (value: string | null) => value ? new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 16) : "";
  const canFinish = row.decision === "approved" && row.starts_on &&
    ["skip", "done"].includes(row.briefing) && ["skip", "graded"].includes(row.test);
  const canInvite = canFinish && row.deadline && !row.briefing_followup;
  const design = data.briefingDesign;
  const briefingWorkflow = Boolean(design && row.applicant_email && ["booked", "done"].includes(row.briefing) &&
    !["withdrawn", "rejected"].includes(row.decision));

  function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form);
    void save("update", { ...values, id: row.id, revision: row.revision, name: values.name ?? row.name, contact: values.contact ?? row.contact,
      briefing: values.briefing ?? row.briefing, test: values.test ?? row.test, briefing_at: showBriefing ? toTimestamp(form.get("briefing_at")) : row.briefing_at,
      test_at: showTest ? toTimestamp(form.get("test_at")) : row.test_at, score: values.score ?? row.score,
      confirmConsent: form.has("consent"), confirmReceipt: form.has("receipt"), issueInvite: (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "issue" });
  }

  return <div className="grid gap-3 border-t pt-3">
    {row.applicant_name && <p className="text-sm">申込者 {row.applicant_name} · {row.applicant_email}{row.applicant_phone ? " · " + row.applicant_phone : ""}</p>}
    {briefingWorkflow && design && <section className="grid gap-3 rounded-lg border bg-neutral-50 p-3" aria-label="説明会後の対応">
      <h4 className="text-sm font-semibold">説明会後の対応</h4>
      {row.trial_dates?.map(at => <p key={at} className="text-sm">体験日時 {toJapanTime(at)}</p>)}
      {!agreed && design.allowTrials && <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
        event.preventDefault();
        const at = toTimestamp(new FormData(event.currentTarget).get("trial"));
        void save("trial", { id: row.id, revision: row.revision, at });
      }}>
        <label className="text-sm">次の体験日時（日本時間）<input className={field} name="trial" type="datetime-local" required /></label>
        <button disabled={busy} className={button}>体験日時を追加</button>
      </form>}
      {!agreed && <form className="grid gap-2" onSubmit={event => {
        event.preventDefault();
        const payload = new FormData(event.currentTarget);
        const delivery = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
        void save("briefingFollowup", { id: row.id, revision: row.revision, email: delivery === "mail",
          firstDays: payload.getAll("firstDay").filter(Boolean), deadline: payload.get("deadline") });
      }}>
        <label className="text-sm">回答期限<input className={field} name="deadline" type="date" required
          defaultValue={row.deadline ?? new Date(Date.now() + 7 * 86400000 + 9 * 3600000).toISOString().slice(0, 10)} /></label>
        {Array.from({ length: design.firstDay === "choose" ? 3 : 1 }, (_, index) =>
          <label className="text-sm" key={index}>{design.firstDay === "choose" ? "初日の候補 " + (index + 1) : "初日の指定"}
            <input className={field} name="firstDay" type="date" required={index === 0} defaultValue={row.briefing_followup?.firstDays[index] ?? (index === 0 ? row.starts_on ?? "" : "")} /></label>)}
        <div className="flex flex-wrap gap-2">
          <button className={button} disabled={busy} value="onsite">その場で入会手続き</button>
          <button className={button} disabled={busy} value="mail">入会案内を送る</button>
        </div>
      </form>}
      {!agreed && row.briefing_followup && row.invite_token && <div className="grid gap-1 text-sm">
        <a className="underline" href={"/class-admission#" + row.invite_token} target="_blank" rel="noreferrer">申込フォームを表示</a>
        <label>申込者の端末で開くリンク<input className={field} readOnly value={typeof window === "undefined" ? "" :
          window.location.origin + "/class-admission#" + row.invite_token} onFocus={event => event.currentTarget.select()} /></label>
      </div>}
      {agreed && <p className="text-sm">申込受付済み{row.starts_on ? " ／ 初日 " + row.starts_on : ""}</p>}
      {row.application_fields && <dl className="grid gap-1 text-sm">
        {Object.entries(row.application_fields).map(([key, value]) => <div key={key} className="flex flex-wrap gap-2">
          <dt>{applicationFields[key as ApplicationField] ?? key}</dt><dd>{value}</dd>
        </div>)}
      </dl>}
    </section>}
    <button type="button" className="w-fit text-sm underline" onClick={() => setCorrection(value => !value)}>{correction ? "通常の表示に戻る" : "修正する"}</button>
    <form onSubmit={update}>
      <fieldset disabled={busy} className="grid gap-2">
        {correction && <>
          <label className="text-sm">{labels.learner}の名前<input className={field} name="name" defaultValue={row.name} maxLength={120} required /></label>
          <label className="text-sm">連絡先<input className={field} name="contact" defaultValue={row.contact} maxLength={300} /></label>
        </>}
        {showBriefing && <>
          <Select name="briefing" label="説明会・体験" values={options.briefing} initial={row.briefing} />
          <label className="text-sm">説明会の日時（日本時間）<input className={field} type="datetime-local" name="briefing_at" defaultValue={toLocal(row.briefing_at)} /></label>
        </>}
        {showTest && <>
          <Select name="test" label="テスト" values={options.test} initial={row.test} />
          <label className="text-sm">テスト日時（日本時間）<input className={field} type="datetime-local" name="test_at" defaultValue={toLocal(row.test_at)} /></label>
          <label className="text-sm">採点・結果<input className={field} name="score" defaultValue={row.score} maxLength={120} /></label>
        </>}
        <Select name="decision" label={labels.operator + "の確認"} values={options.decision} initial={row.decision} />
        <details open={row.decision === "approved" || undefined}>
          <summary className="cursor-pointer text-sm">{labels.admission}案内・正式手続き</summary>
          <div className="mt-2 grid gap-2">
            <label className="text-sm">開始予定日<input className={field} type="date" name="starts_on" defaultValue={row.starts_on ?? ""} /></label>
            <label className="text-sm">回答期限<input className={field} type="date" name="deadline" defaultValue={row.deadline ?? ""} /></label>
            <Select name="payment" label="初回費用の方法" values={options.payment} initial={row.payment === "free" && row.decision === "pending" && row.briefing !== "skip" ? data.paymentMode ?? row.payment : row.payment} />
            {terms && <p className="whitespace-pre-wrap rounded bg-neutral-50 p-2 text-sm">{terms}</p>}
            {agreed ? <p className="text-sm">同意済み</p> : !row.briefing_followup && <label className="text-sm"><input type="checkbox" name="consent" /> 本人または{data.settings.proxy ? labels.proxy : labels.learner}の同意を確認した</label>}
            {row.received_at ? <p className="text-sm">受領記録あり</p> : <label className="text-sm"><input type="checkbox" name="receipt" /> 初回費用を受領した</label>}
          </div>
        </details>
        <div className="flex flex-wrap gap-2">
          <button className={button}>保存</button>
          {canInvite && <button className={button} value="issue">{row.invite_token ? "案内リンクを再発行" : "案内リンクを発行"}</button>}
        </div>
      </fieldset>
    </form>
    {row.invite_token && canInvite && <label className="text-sm">本人に渡す案内リンク<input className={field} readOnly
      value={typeof window === "undefined" ? "" : window.location.origin + "/class-admission#" + row.invite_token}
      onFocus={event => event.currentTarget.select()} /></label>}
    {row.applicant_email && row.invite_token && canInvite && <button type="button" disabled={busy} className={button}
      onClick={() => void save("email", { id: row.id, kind: "invite" })}>申込者に入会案内をメールで送る</button>}
    {row.applicant_email && agreed && row.payment !== "free" && <MailForm title="初回費用をメールで案内" busy={busy}
      onSend={instructions => save("email", { id: row.id, kind: "payment", instructions })} />}
    {canFinish && agreed && (row.payment !== "advance" || row.received_at) && <button type="button" className={button} disabled={busy}
      onClick={() => void save("finish", { id: row.id })}>名簿に登録</button>}
  </div>;
}


function MailForm({ title, busy, onSend }: { title: string; busy: boolean; onSend: (text: string) => Promise<boolean> }) {
  return <form className="grid gap-2" onSubmit={event => {
    event.preventDefault();
    void onSend(String(new FormData(event.currentTarget).get("instructions") ?? ""));
  }}>
    <label className="text-sm">{title}<textarea className={field} name="instructions" rows={3} required maxLength={2000} /></label>
    <button className={button} disabled={busy}>メールを送る</button>
  </form>;
}
