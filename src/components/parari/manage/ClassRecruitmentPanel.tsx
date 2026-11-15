"use client";
import { useEffect, useState, type FormEvent } from "react";
import ClassIntakeForm from "@/components/parari/classes/ClassIntakeForm";
import type { IntakeOptions } from "@/lib/classIntakeOptions";
import type { AdmissionsData } from "@/lib/classAdmissions";
import { classRequest } from "@/lib/classRequests";

type Data = { school: string; recruitment: (IntakeOptions & { public_id: string; enabled: boolean; information: string; kind: string }) | null;
  slots: { id: string; starts_at: string; capacity: number; closed: boolean; meeting_url: string | null; location: string | null; duration_minutes: number }[] };
const field = "block w-full rounded border p-2";
const button = "w-fit rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50";

export default function ClassRecruitmentPanel({ view, onOpenSettings }: { view: "settings" | "preview"; onOpenSettings: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [route, setRoute] = useState("briefing");
  const [paymentMode, setPaymentMode] = useState("free");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<AdmissionsData["settings"] | null>(null);
  const [useSample, setUseSample] = useState(false);
  const [slotId, setSlotId] = useState("");
  const [step, setStep] = useState(0);
  const [scenario, setScenario] = useState("advance");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([classRequest<Data>("/recruitment", undefined, controller.signal),
      classRequest<AdmissionsData>("/admissions?settings=1", undefined, controller.signal)])
      .then(([result, admissions]) => { if (!controller.signal.aborted) { setData(result); setSettings(admissions.settings); setRoute(result.recruitment?.route ?? "briefing"); setPaymentMode(result.recruitment?.payment_mode ?? "free"); setScenario(result.recruitment?.payment_mode ?? "advance"); } })
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
  const isDirect = recruitment?.route === "direct";
  const slots = data?.slots.filter(slot => !slot.closed && Date.parse(slot.starts_at) > Date.now()) ?? [];
  const previewSlots = useSample ? [{ id: "sample", starts_at: new Date(Date.now() + 7 * 86400000).toISOString(), meeting_url: null }] : slots;
  const selectedSlot = previewSlots.find(slot => slot.id === slotId);
  const kind = recruitment?.kind ?? "説明会";
  return <section className="grid gap-3 rounded-2xl border bg-white p-5">
    <h3 className="font-bold">{view === "preview" ? "申込者として試す" : "説明会・体験の募集"}</h3>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">読み込み中…</p>}
    {data && settings && view === "preview" && <>
      <p className="text-sm text-neutral-600">練習用です。予約・メール・支払い・名簿登録は発生しません。</p>
      {(!recruitment || (!isDirect && !slots.length)) && <div className="grid gap-2 rounded-lg bg-neutral-50 p-3">
        <p>{!recruitment ? "このクラスの募集案内はまだ保存されていません。" : "受付中の予約枠がまだありません。"}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={button} onClick={onOpenSettings}>入会設定で{!recruitment ? "募集案内を書く" : "予約枠を追加する"}</button>
          {!useSample && <button type="button" className="text-sm underline" onClick={() => { setUseSample(true); setStep(0); }}>サンプルで試す</button>}
        </div>
        {useSample && <p className="text-sm">サンプルの予約枠を表示しています。</p>}
      </div>}
      {(useSample || (recruitment && (isDirect || slots.length > 0))) &&
        <div className="mx-auto grid w-full max-w-sm gap-3 rounded-2xl border p-4">
          {step === 0 && <ClassIntakeForm data={{ school: data.school, information: recruitment?.information ?? "これは練習用の案内です。日時を選んで説明会の予約をお試しください。", kind, slots: previewSlots, direct: isDirect, terms: settings.terms, applicationText: isDirect ? recruitment?.application_text : undefined }}
            submit={event => { event.preventDefault(); setSlotId(String(new FormData(event.currentTarget).get("slot"))); setStep(isDirect ? 3 : 1); }} />}
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
            {isDirect && <p role="status">申し込みを受け付けました。</p>}
            {recruitment?.confirmation_text && <p className="whitespace-pre-wrap">{recruitment.confirmation_text}</p>}
            {recruitment?.payment_mode === "onsite" && <p className="whitespace-pre-wrap">{recruitment.arrival_text}</p>}
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
          {!isDirect && !slots.length && <p className="text-sm">発行には受付中の予約枠が必要です。</p>}
          <button type="button" className={button} disabled={busy || (!isDirect && !slots.length)} onClick={() => void save({ action: "publish" })}>募集を発行</button>
        </>}
      </div>}
    </>}
    {data && view === "settings" && <><form onSubmit={configure} className="grid gap-2">
      <label><input type="checkbox" checked={route === "briefing"} onChange={event => setRoute(event.target.checked ? "briefing" : "direct")} /> 説明会・体験の予約を受け付ける</label>
      <input type="hidden" name="route" value={route} />
      <label>受付の種類<select name="kind" className={field} defaultValue={data.recruitment?.kind}>{["説明会", "体験", "見学"].map(kind => <option key={kind}>{kind}</option>)}</select></label>
      <label>案内・個人情報の取り扱い<textarea className={field} name="information" maxLength={4000} required defaultValue={data.recruitment?.information} /></label>
      <label>入会申込書の説明<textarea name="applicationText" className={field} maxLength={4000} defaultValue={recruitment?.application_text} /></label>
      <label>初回の支払い方法<select name="paymentMode" className={field} value={paymentMode} onChange={event => setPaymentMode(event.target.value)}>
        <option value="free">無料</option><option value="onsite">現地払い</option><option value="advance">オンライン支払い（決済ページのURL）</option>
      </select></label>
      {paymentMode === "advance" && <label>決済ページのURL<input name="paymentUrl" type="url" required className={field} defaultValue={recruitment?.payment_url ?? ""} /></label>}
      {paymentMode === "onsite" && <label>当日の集合・支払い案内<textarea name="arrivalText" className={field} maxLength={4000} required defaultValue={recruitment?.arrival_text} /></label>}
      <label>確認メールに追加する案内<textarea name="confirmationText" className={field} maxLength={4000} defaultValue={recruitment?.confirmation_text} /></label>
      <button className={button} disabled={busy}>募集を保存</button>
    </form>
    {data.recruitment?.enabled && <a className="underline" href={`/class-intake/${data.recruitment.public_id}`} target="_blank" rel="noreferrer">公開受付ページを開く</a>}
    {route === "briefing" && !data.recruitment && <p>募集を保存すると、この下で予約枠を設定できます。</p>}
    {route === "briefing" && data.recruitment && <>
      <h4 className="font-semibold">予約パネル</h4>
      <form className="grid gap-2" onSubmit={async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        const id = form.dataset.requestId || crypto.randomUUID();
        form.dataset.requestId = id;
        if (await save({ action: "slot", id, startsAt: values.get("startsAt") + ":00+09:00", capacity: Number(values.get("capacity")), meetingUrl: values.get("meetingUrl"), duration: Number(values.get("duration")), location: values.get("location") })) {
          delete form.dataset.requestId; form.reset();
        }
      }}>
        <label>開催日時（日本時間）<input className={field} name="startsAt" type="datetime-local" required /></label>
        <label>会場・集合場所<input className={field} name="location" maxLength={300} /></label>
        <label>所要時間（分）<input className={field} name="duration" type="number" min="5" max="480" defaultValue="60" required /></label>
        <label>定員<input className={field} name="capacity" type="number" min="1" max="100" defaultValue="1" required /></label>
        <label>説明会・体験のオンライン参加リンク（任意）<input type="url" className={field} name="meetingUrl" maxLength={2000} /></label>
        <button className={button} disabled={busy}>予約枠を追加</button>
      </form>
      {data.slots.map(slot => <p className="text-sm" key={slot.id}>{new Date(slot.starts_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} ／ {slot.duration_minutes}分 ／ {slot.capacity}人{slot.location ? " ／ " + slot.location : ""}{" "}
        {slot.closed ? "受付終了" : <button disabled={busy} className="underline" type="button" onClick={() => void save({ action: "close", id: slot.id })}>新規受付を終了</button>}</p>)}
    </>}</>}
  </section>;
}
