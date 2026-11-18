"use client";

import { useEffect, useState } from "react";
import { classRequest } from "@/lib/classRequests";
import type { AdmissionsData } from "@/lib/classAdmissions";
import ClassBookingCalendar, { bookingDate, bookingTime } from "@/components/parari/classes/ClassBookingCalendar";

const routes = {
  onsite: "直接申込・現地支払い",
  online: "直接申込・オンライン決済",
  briefing: "説明会・体験から始める",
} as const;
const fields = {
  name: "氏名", email: "メールアドレス", phone: "電話番号", address: "住所",
  school: "所属・学校名", guardianName: "保護者名", guardianEmail: "保護者のメールアドレス",
  guardianPhone: "保護者の電話番号", guardianAddress: "保護者の住所",
} as const;
type Field = keyof typeof fields;
type Rule = "required" | "optional" | "hidden";
type Route = keyof typeof routes;
type Mail = "received" | "paid" | "booked" | "briefing" | "invite" | "paymentRequest" | "firstDay" | "onsitePayment" | "reminder";
const messages: Record<Mail, { subject: string; body: string }> = {
  received: { subject: "{教室名}の入会申込を受け付けました", body: "お申し込みありがとうございます。以下のボタンから次の手続きへお進みください。" },
  onsitePayment: { subject: "{教室名}の当日のお支払い", body: "初日に会場でお支払いをお願いします。" },
  paymentRequest: { subject: "{教室名}からお支払いのご案内", body: "保護者の方へ。以下のボタンからお支払いをお願いします。" },
  firstDay: { subject: "{教室名}の初日の手続きができます", body: "以下のボタンから、初日の手続きへお進みください。" },
  paid: { subject: "{教室名}のお支払いを確認しました", body: "お支払いありがとうございます。初回の参加日をお選びください。" },
  booked: { subject: "{教室名}の初日のご案内", body: "初日の日時：{日時}\n集合場所：{会場}" },
  reminder: { subject: "{教室名}の説明会・体験は明日です", body: "ご予約の日時をご確認ください。" },
  briefing: { subject: "{教室名}の説明会・体験の予約を受け付けました", body: "日時：{日時}\n集合場所：教室（サンプル）" },
  invite: { subject: "{教室名}からの入会案内", body: "ご参加ありがとうございました。入会をご希望の場合は、以下からお申し込みください。" },
};
const field = "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2";
const action = "w-fit rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50";
const secondary = "rounded-lg border px-3 py-2 text-sm";
const fieldIds = Object.keys(fields) as Field[];

type Audience = "adult" | "minor";
type FormProfile = { rules: Record<Field, Rule>; schoolLabel: string };
type Draft = {
  route: Route; audience: Audience | null; forms: Record<Audience, FormProfile>; firstDay: "choose" | "assigned";
  allowTrials: boolean; introduction: string; arrival: string; amount: string; mail: Record<Mail, { subject: string; body: string }>;
};
const audienceLabels = { adult: "成人向け", minor: "未成年向け" } as const;
const adultRules: FormProfile["rules"] = {
  name: "required", email: "required", phone: "optional", address: "optional", school: "hidden",
  guardianName: "required", guardianEmail: "required", guardianPhone: "required", guardianAddress: "required",
};
const defaults: Draft = {
  route: "onsite", audience: null,
  forms: { adult: { rules: adultRules, schoolLabel: fields.school },
    minor: { rules: { ...adultRules, email: "required" }, schoolLabel: fields.school } },
  firstDay: "choose", allowTrials: true, introduction: "", arrival: "", amount: "", mail: messages,
};

function readDraft(raw: string): Draft {
  const { rules, schoolLabel, forms, audience, ...saved } = JSON.parse(raw) as Partial<Draft> & Partial<FormProfile>;
  const restoreForm = (kind: Audience): FormProfile => ({
    schoolLabel: forms?.[kind]?.schoolLabel ?? schoolLabel ?? defaults.forms[kind].schoolLabel,
    rules: { ...defaults.forms[kind].rules, ...rules,
      ...forms?.[kind]?.rules, name: "required", email: "required",
      ...(kind === "minor" ? { guardianName: "required", guardianEmail: "required", guardianPhone: "required", guardianAddress: "required" } as const : {}) },
  });
  return { ...defaults, ...saved, audience: audience === "adult" || audience === "minor" ? audience : null, forms: { adult: restoreForm("adult"), minor: restoreForm("minor") },
    mail: { ...messages, ...saved.mail } };
}
const steps = ["入会方法", "申込フォーム", "初日・メール", "申込者として試す"];
const samples = ["最初のクラス開催日 16:00", "次のクラス開催日 16:00"];

function mailSequence(route: Route, minor: boolean): Mail[] {
  if (route === "briefing") return ["briefing", "reminder", "invite", "received", "booked"];
  if (route === "onsite") return minor ? ["received", "booked", "onsitePayment"] : ["received", "booked"];
  return minor ? ["received", "paymentRequest", "paid", "firstDay", "booked"] : ["received", "paid", "booked"];
}

export default function ClassAdmissionBlueprint({ schoolId, schoolName, guided = false, onSaved, onSaveError }: { schoolId: string; schoolName: string; guided?: boolean; onSaved?: () => void; onSaveError?: () => void }) {
  const [draft, setDraft] = useState({ ...defaults, route: guided ? "briefing" as const : defaults.route });
  const visibleSteps = guided ? steps.slice(0, 3) : steps;
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Mail | "form" | "account" | "payment" | "date" | "briefingDate" | "meeting" | "trial">("form");
  const [briefingSlot, setBriefingSlot] = useState("");
  const [sameAddress, setSameAddress] = useState(false);
  const [date, setDate] = useState(samples[0]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const key = "parari:class-admission-blueprint:v1:" + schoolId;

  useEffect(() => {
    try {
      const saved = guided ? null : window.localStorage.getItem(key);
      if (saved) setDraft(readDraft(saved));
      else {
        const controller = new AbortController();
        void classRequest<AdmissionsData>("/admissions?settings=1", undefined, controller.signal).then(result => {
          const design = result.briefingDesign;
          if (design && !controller.signal.aborted) setDraft(readDraft(JSON.stringify({ ...design, route: "briefing" })));
        }).catch(() => {});
        return () => controller.abort();
      }
    } catch {
      setNotice("このブラウザーの下書きを読み込めませんでした。");
    }
  }, [key, guided]);

  function persist() {
    try {
      window.localStorage.setItem(key, JSON.stringify(draft));
      setNotice("このブラウザーに下書きを保存しました。");
    } catch {
      setNotice("下書きを保存できませんでした。");
    }
  }

  async function saveBriefing() {
    if (!draft.audience || saving) return;
    setSaving(true);
    setNotice("");
    try {
      await classRequest("/admissions", { action: "briefingDesign", design: { ...draft, ...draft.forms[draft.audience] } });
      onSaved?.();
      setNotice(guided ? "申込書とメールを保存しました。" : "説明会の設計を教室に保存しました。「公開する募集の設定」で予約枠と公開設定を確認してください。");
    } catch (error) {
      onSaveError?.();
      setNotice(error instanceof Error ? error.message : "説明会の設計を保存できませんでした。");
    } finally { setSaving(false); }
  }

  function selectStep(value: number) {
    setStep(value);
    setPhase(draft.route === "briefing" ? "briefingDate" : "form");
    setBriefingSlot("");
    setSameAddress(false);
    setDate(samples[0]);
    setNotice("");
  }

  const sampleBriefing = Math.ceil((Date.now() + 86400000) / 1800000) * 1800000;
  const sampleSlot = { id: "briefing-sample", starts_at: new Date(sampleBriefing).toISOString(), duration_minutes: 30 };
  const audience = draft.audience ?? "adult";
  const minor = audience === "minor";
  const form = { ...draft.forms[audience], rules: { ...draft.forms[audience].rules, name: "required" as const, email: "required" as const,
    ...(minor ? { guardianName: "required", guardianEmail: "required", guardianPhone: "required", guardianAddress: "required" } as const : {}) } };
  const routeMails = mailSequence(draft.route, minor);
  const label = (id: Field) => id === "school" ? form.schoolLabel.trim() || fields.school : fields[id];
  function updateForm(next: FormProfile) {
    setDraft(current => ({ ...current, forms: { ...current.forms, [audience]: next } }));
  }
  function recipients(mail: Mail) {
    if (!minor) return "受講者本人";
    if (mail === "paymentRequest" || mail === "onsitePayment") return "保護者（支払手続き）・受講者（案内）";
    return "保護者と受講者";
  }
  const resolved = (value: string) => value.replaceAll("{教室名}", schoolName)
    .replaceAll("{日時}", phase === "briefing" ? bookingDate(sampleSlot.starts_at) + " " + bookingTime(sampleBriefing) : date).replaceAll("{会場}", draft.arrival || "教室（サンプル）");
  const dateButton = draft.firstDay === "choose" ? "初日を予約する" : "先生が指定した初日を確認する";
  const fieldControl = (id: Field) => {
    const locked = id === "name" || id === "email" || (minor && id.startsWith("guardian"));
    return <label key={id} className="grid grid-cols-[1fr_8rem] items-center gap-2 text-sm">
      <span>{label(id)}</span>
      <select className={field} disabled={locked} value={locked ? "required" : form.rules[id]}
        onChange={event => updateForm({ ...form, rules: { ...form.rules, [id]: event.target.value as Rule } })}>
        <option value="required">必須</option><option value="optional">任意</option><option value="hidden">表示しない</option>
      </select>
    </label>;
  };
  const previewField = (id: Field) => form.rules[id] === "hidden" || (id === "guardianAddress" && sameAddress) ? null :
    <label key={id} className="grid gap-1 text-sm">{label(id)}{form.rules[id] === "required" ? "（必須）" : ""}
      <input className={field} type={/email/i.test(id) ? "email" : /phone/i.test(id) ? "tel" : "text"}
        placeholder={/email/i.test(id) ? "sample@example.test" : "サンプル"} />
    </label>;

  return <section className="grid gap-4 rounded-2xl border bg-white p-5" aria-label={guided ? "説明会後の申込書・メール" : "入会の設計図"}>
    <header className="grid gap-1">
      <h3 className="font-bold">{guided ? "説明会後の申込書・メール" : "入会の設計図"}</h3>
      <p className="text-sm text-neutral-600">{guided ? "受講対象と必要な情報、初日の決め方、送信するメールを設定して保存します。" : "下書きと申込者プレビューを使って設計できます。説明会ルートは教室に保存して運用に使えます。"}</p>
    </header>
    <nav aria-label="設計図の手順" className="flex flex-wrap gap-2">
      {visibleSteps.map((title, index) => <button type="button" aria-current={index === step ? "step" : undefined}
        className={index === step ? action : secondary} key={title} onClick={() => selectStep(index)}>{title}</button>)}
    </nav>

    {step === 0 && <fieldset className="grid gap-2">
      <legend className="mb-1 font-semibold">入会案内を見た人が次にすること</legend>
      {!guided && (Object.keys(routes) as Route[]).map(route => <label className="flex gap-2 rounded-lg border p-3 text-sm" key={route}>
        <input type="radio" name="blueprint-route" checked={draft.route === route} onChange={() => setDraft({ ...draft, route })} />{routes[route]}
      </label>)}
      <p className="text-sm">{draft.route === "onsite" ? "申込 → 受付メール → 初日の予約・確認 → 当日支払い" :
        draft.route === "online" ? "申込 → 受付メール → オンライン決済 → 決済確認 → 初日の予約・確認" :
        "説明会・体験を予約 → 参加 → 教室からの入会案内 → 申込"}</p>
      <label className="grid gap-1 text-sm">プレビューに表示する入会案内
        <textarea className={field} rows={3} maxLength={4000} value={draft.introduction}
          onChange={event => setDraft({ ...draft, introduction: event.target.value })} />
      </label>
    </fieldset>}

    {step === 1 && <div className="grid gap-4">
      <label className="grid gap-1 text-sm font-medium">申込書の表示確認（受講対象はクラスごとの入会方法で主催者が設定します）
        <select className={field} value={draft.audience ?? ""} onChange={event => {
          const value = event.target.value;
          setDraft(current => ({ ...current, audience: value === "adult" || value === "minor" ? value : null }));
        }}>
          <option value="">確認する対象を選ぶ</option>
          <option value="adult">成人向け</option><option value="minor">未成年向け</option>
        </select>
      </label>
      {draft.audience && <>
      <fieldset className="grid gap-2 rounded-lg border p-3">
        <legend className="px-1 font-medium">{audienceLabels[audience]}の受講者項目</legend>
        {fieldIds.filter(id => !id.startsWith("guardian")).map(fieldControl)}
        {form.rules.school !== "hidden" && <label className="grid gap-1 text-sm">所属欄の表示名
          <input className={field} maxLength={60} value={form.schoolLabel} onChange={event => updateForm({ ...form, schoolLabel: event.target.value })} />
        </label>}
      </fieldset>
      {minor && <fieldset className="grid gap-2 rounded-lg border p-3">
        <legend className="px-1 font-medium">保護者の項目</legend>
        {fieldIds.filter(id => id.startsWith("guardian")).map(fieldControl)}
      </fieldset>}
      <p className="text-sm text-neutral-600">{minor
        ? "本人の氏名・メールと、保護者の氏名・メール・電話・住所が必須です。先生からの連絡は必ず両者に届きます。正式な入会には保護者のPARARI登録・ログインが必要です。"
        : "受講者本人のメール宛てに案内し、本人のPARARIアカウントを申込に紐づけます。"}</p>
      </>}
    </div>}

    {step === 2 && <div className="grid gap-3">
      {draft.route === "briefing" && <label className="text-sm">
        <input type="checkbox" checked={draft.allowTrials} onChange={event => setDraft({ ...draft, allowTrials: event.target.checked })} /> 説明会の後に追加の体験日時を登録する
      </label>}
      <label className="grid gap-1 text-sm">初日の決め方
        <select className={field} value={draft.firstDay} onChange={event => setDraft({ ...draft, firstDay: event.target.value as Draft["firstDay"] })}>
          <option value="choose">申込者が候補日から選ぶ</option><option value="assigned">教室が申込者ごとに指定する</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">初日の会場・集合場所
        <input className={field} maxLength={300} value={draft.arrival} onChange={event => setDraft({ ...draft, arrival: event.target.value })} />
      </label>
      {draft.route === "onsite" && <label className="grid gap-1 text-sm">当日のお支払い金額（円）
        <input className={field} inputMode="numeric" pattern="[0-9]*" maxLength={10} value={draft.amount}
          onChange={event => setDraft({ ...draft, amount: event.target.value.replace(/[^0-9]/g, "") })} />
      </label>}
      {draft.route === "online" && <p className="text-sm text-neutral-600">決済完了メールは、決済サービスから支払い完了を確認した後に送る流れです。</p>}
      {routeMails.map(id => <details className="rounded-lg border p-3" key={id}>
        <summary className="cursor-pointer text-sm font-medium">{messages[id].subject.replace("{教室名}の", "").replace("{教室名}からの", "")}</summary>
        <div className="mt-2 grid gap-2 text-sm">
          {draft.audience && <p>宛先　{recipients(id)}</p>}
          <label>件名<input className={field} maxLength={180} value={draft.mail[id].subject}
            onChange={event => setDraft({ ...draft, mail: { ...draft.mail, [id]: { ...draft.mail[id], subject: event.target.value } } })} /></label>
          <label>本文<textarea className={field} maxLength={4000} rows={3} value={draft.mail[id].body}
            onChange={event => setDraft({ ...draft, mail: { ...draft.mail, [id]: { ...draft.mail[id], body: event.target.value } } })} /></label>
          <p>差し込み項目　{"{教室名}"} {"{日時}"} {"{会場}"}</p>
        </div>
      </details>)}
    </div>}

    {step === 3 && !draft.audience && <button type="button" className={secondary}
      onClick={() => selectStep(1)}>申込フォームで確認する対象を選ぶ</button>}
    {step === 3 && draft.audience && <div className="mx-auto grid w-full max-w-md gap-3 rounded-xl border p-4">
      <p className="text-sm font-medium">{routes[draft.route]}のプレビュー</p>
      {(phase === "form" || phase === "briefingDate") && draft.introduction &&
        <p className="whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-sm">{draft.introduction}</p>}
      {phase === "briefingDate" && <>
        <ClassBookingCalendar slots={[sampleSlot]} bookingWeeks={4} selected={briefingSlot} onSelect={setBriefingSlot} />
        <button type="button" className={action} disabled={!briefingSlot} onClick={() => setPhase("briefing")}>説明会・体験を予約する（練習）</button>
      </>}
      {phase === "form" && <>
        <h4 className="font-semibold">{schoolName}の入会申込（{audienceLabels[audience]}）</h4>
        <div className="grid gap-2" key={audience}>
          {fieldIds.filter(id => !id.startsWith("guardian")).map(previewField)}
        </div>
        {minor && <fieldset className="grid gap-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">保護者情報</legend>
          {form.rules.address !== "hidden" && form.rules.guardianAddress !== "hidden" &&
            <label className="text-sm"><input type="checkbox" checked={sameAddress} onChange={event => setSameAddress(event.target.checked)} /> 住所は受講者と同じ</label>}
          {fieldIds.filter(id => id.startsWith("guardian")).map(previewField)}
        </fieldset>}
        <button type="button" className={action} onClick={() => setPhase("received")}>申し込む（練習）</button>
      </>}
      {phase in messages && <div className="grid gap-2">
        <span className="text-xs text-neutral-600">メールの見本 · 宛先　{recipients(phase as Mail)}</span>
        <h4 className="font-semibold">{resolved(draft.mail[phase as Mail].subject)}</h4>
        <p className="whitespace-pre-wrap text-sm">{resolved(draft.mail[phase as Mail].body)}</p>
        {(phase === "onsitePayment" || (phase === "booked" && draft.route === "onsite" && !minor)) && draft.amount &&
          <p className="text-sm">当日のお支払い　{Number(draft.amount).toLocaleString("ja-JP")}円</p>}
        {phase === "booked" && draft.route === "onsite" && minor &&
          <button type="button" className={action} onClick={() => setPhase("onsitePayment")}>保護者宛ての当日支払い案内を見る</button>}
        {phase === "briefing" && <button type="button" className={action} onClick={() => setPhase("meeting")}>説明会の当日へ</button>}
        {phase === "invite" && <button type="button" className={action} onClick={() => setPhase("account")}>入会を申し込む</button>}
        {phase === "received" && <button type="button" className={action} onClick={() => setPhase(draft.route === "briefing" ? "date" : "account")}>{draft.route === "online" ? minor ? "保護者の手続きに進む" : "支払う" : dateButton}</button>}
        {phase === "paymentRequest" && <button type="button" className={action} onClick={() => setPhase("payment")}>保護者が支払う</button>}
        {phase === "paid" && <button type="button" className={action} onClick={() => setPhase(minor ? "firstDay" : "date")}>
          {minor ? "初日の案内メールを見る" : dateButton}
        </button>}
        {phase === "firstDay" && <button type="button" className={action} onClick={() => setPhase("date")}>{dateButton}</button>}
      </div>}
      {(phase === "meeting" || phase === "trial") && <>
        <h4 className="font-semibold">{phase === "meeting" ? "説明会後の対応（先生の操作）" : "追加の体験日時を登録しました（練習）"}</h4>
        <button type="button" className={action} onClick={() => setPhase("account")}>その場で入会手続き</button>
        <button type="button" className={secondary} onClick={() => setPhase("invite")}>入会案内を送る</button>
        {phase === "meeting" && draft.allowTrials && <button type="button" className={secondary} onClick={() => setPhase("trial")}>体験日時を追加</button>}
      </>}
      {phase === "account" && <>
        <h4 className="font-semibold">{minor ? "保護者のPARARI登録・ログイン" : "PARARI登録・ログイン"}</h4>
        <button type="button" className={action} onClick={() => setPhase(draft.route === "briefing" ? "form" : draft.route === "online" ? minor ? "paymentRequest" : "payment" : "date")}>紐づけ完了後の画面を見る</button>
      </>}
      {phase === "payment" && <button type="button" className={action} onClick={() => setPhase("paid")}>決済完了メールを見る（練習）</button>}
      {phase === "date" && <>
        {draft.firstDay === "choose" ? <label className="grid gap-1 text-sm">初回の参加日を選ぶ
          <select className={field} value={date} onChange={event => setDate(event.target.value)}>
            {samples.map(sample => <option key={sample}>{sample}</option>)}
          </select>
        </label> : <p className="text-sm">先生が指定した初日　{date}</p>}
        <button type="button" className={action} onClick={() => setPhase("booked")}>{draft.firstDay === "choose" ? "この日を予約する" : "初日の案内メールを見る"}</button>
      </>}
      <button type="button" className={secondary} onClick={() => selectStep(3)}>最初から試す</button>
    </div>}

    <footer className="flex flex-wrap items-center gap-2">
      {!guided && <button type="button" className={secondary} onClick={persist}>下書きを保存</button>}
      {draft.route === "briefing" && <button type="button" data-setup-save className={action} disabled={!draft.audience || saving}
        onClick={() => void saveBriefing()}>{guided ? "申込書とメールを保存" : "説明会の設計を教室に保存"}</button>}
      {step < visibleSteps.length - 1 && <button type="button" className={action} onClick={() => selectStep(step + 1)}>次へ</button>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
    </footer>
  </section>;
}
