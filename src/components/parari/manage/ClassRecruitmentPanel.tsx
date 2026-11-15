"use client";
import { useEffect, useState, type FormEvent } from "react";
import ClassIntakeForm from "@/components/parari/classes/ClassIntakeForm";
import type { AdmissionsData } from "@/lib/classAdmissions";
import { classRequest } from "@/lib/classRequests";

type Data = { school: string; recruitment: { public_id: string; enabled: boolean; information: string; kind: string } | null;
  slots: { id: string; starts_at: string; capacity: number; closed: boolean; meeting_url: string | null }[] };
const field = "block w-full rounded border p-2";
const button = "w-fit rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50";

export default function ClassRecruitmentPanel({ view }: { view: "settings" | "flow" | "preview" }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<AdmissionsData["settings"] | null>(null);
  const [slotId, setSlotId] = useState("");
  const [step, setStep] = useState(0);
  const [scenario, setScenario] = useState("advance");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([classRequest<Data>("/recruitment", undefined, controller.signal),
      classRequest<AdmissionsData>("/admissions?settings=1", undefined, controller.signal)])
      .then(([result, admissions]) => { if (!controller.signal.aborted) { setData(result); setSettings(admissions.settings); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, []);
  async function save(values: object) {
    setBusy(true);
    setError("");
    try { await classRequest("/recruitment", values); setData(await classRequest<Data>("/recruitment")); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存できませんでした。"); return false; }
    finally { setBusy(false); }
  }
  function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void save({ ...Object.fromEntries(form), action: "settings" });
  }
  const recruitment = data?.recruitment;
  const slots = data?.slots.filter(slot => !slot.closed && Date.parse(slot.starts_at) > Date.now()) ?? [];
  const selectedSlot = slots.find(slot => slot.id === slotId);
  const kind = recruitment?.kind ?? "説明会";
  const flow = [
    ["申込者", kind + "を予約"],
    ["申込者", kind + "に参加"],
    ...(settings?.test ? [["教室", "受験・採点を確認"]] : []),
    ["教室", "確認して入会案内を送る"],
    ["申込者", "規約に同意して申し込む"],
    ["教室", "入金を確認して名簿に登録"],
    ["教室", "初回の日程を案内"],
  ];
  return <section className="grid gap-3 rounded-2xl border bg-white p-5">
    <h3 className="font-bold">{view === "flow" ? "入会までのフロー" : view === "preview" ? "申込者として試す" : "説明会・体験の募集"}</h3>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">読み込み中…</p>}
    {data && settings && view === "flow" && <ol className="grid gap-3">
      {flow.map(([actor, title], index) => <li className="rounded-lg border p-3" key={title}>
        <span className="mr-2 text-sm text-neutral-600">{index + 1} · {actor}</span>{title}
      </li>)}
      <li className="text-sm text-neutral-600">保留・不合格の場合は案内前に止まり、同意・入金待ちは申込者の対応を待ちます。</li>
    </ol>}
    {data && settings && view === "preview" && <>
      <p className="text-sm text-neutral-600">練習用です。予約・メール・支払い・名簿登録は発生しません。</p>
      {!recruitment ? <p>入会設定で募集の案内を保存してください。</p> :
        <div className="mx-auto grid w-full max-w-sm gap-3 rounded-2xl border p-4">
          {step === 0 && <ClassIntakeForm data={{ school: data.school, information: recruitment.information, kind, slots }}
            submit={event => { event.preventDefault(); setSlotId(String(new FormData(event.currentTarget).get("slot"))); setStep(1); }} />}
          {step === 1 && <>
            <h4 className="font-bold">予約を受け付けました</h4>
            <p>確認メールで日時{selectedSlot?.meeting_url ? "とオンライン参加方法" : ""}をお知らせします。</p>
            {selectedSlot && <p>{new Date(selectedSlot.starts_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（日本時間）</p>}
            <p>{settings.test ? "テストと教室からの確認をお待ちください。" : "参加後は教室からの案内をお待ちください。"}</p>
            <button type="button" className={button} onClick={() => setStep(2)}>教室から案内が届いた場合を試す</button>
          </>}
          {step === 2 && <form className="grid gap-3" onSubmit={event => { event.preventDefault(); setStep(3); }}>
            <h4 className="font-bold">{settings.labels.admission}手続き</h4>
            {settings.terms && <p className="whitespace-pre-wrap">{settings.terms}</p>}
            <label><input type="checkbox" required /> 案内内容に同意して申し込みます</label>
            <button className={button}>同意して申し込む</button>
          </form>}
          {step === 3 && <>
            <label>試す支払条件<select className={field} value={scenario} onChange={e => setScenario(e.target.value)}>
              <option value="advance">事前払い</option><option value="onsite">当日払い</option><option value="free">無料</option>
            </select></label>
            <p>{scenario === "advance" ? "支払い方法と期限は教室からご案内します。" : scenario === "onsite" ? "初回当日にお支払いください。" : "初回費用はありません。"}</p>
            <button className={button} type="button" onClick={() => setStep(4)}>教室が名簿に登録した場合を試す</button>
          </>}
          {step === 4 && <p>{settings.labels.admission}手続きが完了しました。初回の日程は教室からの案内をご確認ください。</p>}
          {step > 0 && <button className="w-fit text-sm underline" type="button" onClick={() => setStep(0)}>最初から試す</button>}
        </div>}
      {recruitment && <div className="grid gap-2 border-t pt-3">
        {recruitment.enabled ? <>
          <a className="underline" href={`/class-intake/${recruitment.public_id}`}>公開受付ページを開く</a>
          <button type="button" className={button} disabled={busy} onClick={() => void save({ action: "unpublish" })}>募集を非公開にする</button>
        </> : <>
          {!slots.length && <p className="text-sm">発行には受付中の予約枠が必要です。</p>}
          <button type="button" className={button} disabled={busy || !slots.length} onClick={() => void save({ action: "publish" })}>募集を発行</button>
        </>}
      </div>}
    </>}
    {data && view === "settings" && <><form onSubmit={configure} className="grid gap-2">
      <label>受付の種類<select name="kind" className={field} defaultValue={data.recruitment?.kind}>{["説明会", "体験", "見学"].map(kind => <option key={kind}>{kind}</option>)}</select></label>
      <label>案内・個人情報の取り扱い<textarea className={field} name="information" maxLength={4000} required defaultValue={data.recruitment?.information} /></label>
      <button className={button} disabled={busy}>募集を保存</button>
    </form>
    {data.recruitment && <>
      {data.recruitment.enabled && <a className="underline" href={`/class-intake/${data.recruitment.public_id}`} target="_blank" rel="noreferrer">公開受付ページを開く</a>}
      <form className="grid gap-2" onSubmit={async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        const id = form.dataset.requestId || crypto.randomUUID();
        form.dataset.requestId = id;
        if (await save({ action: "slot", id, startsAt: values.get("startsAt") + ":00+09:00", capacity: Number(values.get("capacity")), meetingUrl: values.get("meetingUrl") })) {
          delete form.dataset.requestId; form.reset();
        }
      }}>
        <label>開催日時（日本時間）<input className={field} name="startsAt" type="datetime-local" required /></label>
        <label>定員<input className={field} name="capacity" type="number" min="1" max="100" defaultValue="1" required /></label>
        <label>説明会・体験のオンライン参加リンク（任意）<input type="url" className={field} name="meetingUrl" maxLength={2000} /></label>
        <button className={button} disabled={busy}>予約枠を追加</button>
      </form>
      {data.slots.map(slot => <p className="text-sm" key={slot.id}>{new Date(slot.starts_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} ／ {slot.capacity}人{" "}
        {slot.closed ? "受付終了" : <button disabled={busy} className="underline" type="button" onClick={() => void save({ action: "close", id: slot.id })}>新規受付を終了</button>}</p>)}
    </>}</>}
  </section>;
}
