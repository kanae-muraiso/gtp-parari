"use client";

import { useEffect, useState } from "react";
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
type Mail = "received" | "paid" | "booked" | "briefing" | "invite";
const messages: Record<Mail, { subject: string; body: string }> = {
  received: { subject: "{教室名}の入会申込を受け付けました", body: "お申し込みありがとうございます。以下のボタンから次の手続きへお進みください。" },
  paid: { subject: "{教室名}のお支払いを確認しました", body: "お支払いありがとうございます。初回の参加日をお選びください。" },
  booked: { subject: "{教室名}の初日のご案内", body: "初日の日時：{日時}\n集合場所：{会場}" },
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
  route: Route; audience: Audience | "both"; forms: Record<Audience, FormProfile>; firstDay: "choose" | "assigned";
  introduction: string; arrival: string; amount: string; mail: Record<Mail, { subject: string; body: string }>;
};
const audienceLabels = { adult: "成人向け", minor: "未成年向け", both: "両方を受け付ける" } as const;
const adultRules: FormProfile["rules"] = {
  name: "required", email: "required", phone: "optional", address: "optional", school: "hidden",
  guardianName: "required", guardianEmail: "required", guardianPhone: "optional", guardianAddress: "optional",
};
const defaults: Draft = {
  route: "onsite", audience: "both",
  forms: { adult: { rules: adultRules, schoolLabel: fields.school },
    minor: { rules: { ...adultRules, email: "optional" }, schoolLabel: fields.school } },
  firstDay: "choose", introduction: "", arrival: "", amount: "", mail: messages,
};

function readDraft(raw: string): Draft {
  const { rules, schoolLabel, forms, ...saved } = JSON.parse(raw) as Partial<Draft> & Partial<FormProfile>;
  const restoreForm = (kind: Audience): FormProfile => ({
    schoolLabel: forms?.[kind]?.schoolLabel ?? schoolLabel ?? defaults.forms[kind].schoolLabel,
    rules: { ...defaults.forms[kind].rules, ...rules,
      ...(kind === "minor" && !forms?.minor ? { email: "optional" as const } : {}), ...forms?.[kind]?.rules },
  });
  return { ...defaults, ...saved, forms: { adult: restoreForm("adult"), minor: restoreForm("minor") },
    mail: { ...messages, ...saved.mail } };
}
const steps = ["入会方法", "申込フォーム", "初日・メール", "申込者として試す"];
const samples = ["最初のクラス開催日 16:00", "次のクラス開催日 16:00"];

function mailSequence(route: Route): Mail[] {
  if (route === "briefing") return ["briefing", "invite", "received", "booked"];
  return route === "online" ? ["received", "paid", "booked"] : ["received", "booked"];
}

export default function ClassAdmissionBlueprint({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const [draft, setDraft] = useState(defaults);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Mail | "form" | "account" | "payment" | "date" | "briefingDate">("form");
  const [briefingSlot, setBriefingSlot] = useState("");
  const [formTab, setFormTab] = useState<Audience>("adult");
  const [previewTab, setPreviewTab] = useState<Audience>("adult");
  const [sameAddress, setSameAddress] = useState(false);
  const [date, setDate] = useState(samples[0]);
  const [notice, setNotice] = useState("");
  const key = "parari:class-admission-blueprint:v1:" + schoolId;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (!saved) return;
      setDraft(readDraft(saved));
    } catch {
      setNotice("このブラウザーの下書きを読み込めませんでした。");
    }
  }, [key]);

  function persist() {
    try {
      window.localStorage.setItem(key, JSON.stringify(draft));
      setNotice("このブラウザーに下書きを保存しました。");
    } catch {
      setNotice("下書きを保存できませんでした。");
    }
  }

  function selectStep(value: number) {
    setStep(value);
    setPhase(draft.route === "briefing" ? "briefingDate" : "form");
    setBriefingSlot("");
    setPreviewTab(formTab);
    setSameAddress(false);
    setDate(samples[0]);
    setNotice("");
  }

  const sampleBriefing = Math.ceil((Date.now() + 86400000) / 1800000) * 1800000;
  const sampleSlot = { id: "briefing-sample", starts_at: new Date(sampleBriefing).toISOString(), duration_minutes: 30 };
  const routeMails = mailSequence(draft.route);
  const editing = draft.audience === "both" ? formTab : draft.audience;
  const previewing = draft.audience === "both" ? previewTab : draft.audience;
  const minor = previewing === "minor";
  const editForm = draft.forms[editing];
  const shownForm = draft.forms[previewing];
  const label = (id: Field, form: FormProfile) => id === "school" ? form.schoolLabel.trim() || fields.school : fields[id];
  function updateForm(next: FormProfile) {
    setDraft(current => ({ ...current, forms: { ...current.forms, [editing]: next } }));
  }
  function chooseProfile(value: Audience, select: (kind: Audience) => void) {
    select(value);
    setSameAddress(false);
  }
  function profileButtons(value: Audience, select: (kind: Audience) => void) {
    return <div className="flex flex-wrap gap-2" aria-label="申込フォームの対象">
      {(["adult", "minor"] as const).map(kind => <button key={kind} type="button" aria-pressed={value === kind}
        className={value === kind ? action : secondary} onClick={() => chooseProfile(kind, select)}>{audienceLabels[kind]}</button>)}
    </div>;
  }
  const resolved = (value: string) => value.replaceAll("{教室名}", schoolName)
    .replaceAll("{日時}", phase === "briefing" ? bookingDate(sampleSlot.starts_at) + " " + bookingTime(sampleBriefing) : date).replaceAll("{会場}", draft.arrival || "教室（サンプル）");
  const dateButton = draft.firstDay === "choose" ? "初日を予約する" : "先生が指定した初日を確認する";
  const fieldControl = (id: Field) => {
    const locked = id === "name" || (editing === "adult" ? id === "email" : id === "guardianEmail");
    return <label key={id} className="grid grid-cols-[1fr_8rem] items-center gap-2 text-sm">
      <span>{label(id, editForm)}</span>
      <select className={field} disabled={locked} value={locked ? "required" : editForm.rules[id]}
        onChange={event => updateForm({ ...editForm, rules: { ...editForm.rules, [id]: event.target.value as Rule } })}>
        <option value="required">必須</option><option value="optional">任意</option><option value="hidden">表示しない</option>
      </select>
    </label>;
  };
  const previewField = (id: Field) => shownForm.rules[id] === "hidden" || (id === "guardianAddress" && sameAddress) ? null :
    <label key={id} className="grid gap-1 text-sm">{label(id, shownForm)}{shownForm.rules[id] === "required" ? "（必須）" : ""}
      <input className={field} type={/email/i.test(id) ? "email" : /phone/i.test(id) ? "tel" : "text"}
        placeholder={/email/i.test(id) ? "sample@example.test" : "サンプル"} />
    </label>;

  return <section className="grid gap-4 rounded-2xl border bg-white p-5" aria-label="入会の設計図">
    <header className="grid gap-1">
      <h3 className="font-bold">入会の設計図</h3>
      <p className="text-sm text-neutral-600">試作です。このブラウザーに下書きを保存し、架空の内容で申込者の流れを確認できます。</p>
    </header>
    <nav aria-label="設計図の手順" className="flex flex-wrap gap-2">
      {steps.map((title, index) => <button type="button" aria-current={index === step ? "step" : undefined}
        className={index === step ? action : secondary} key={title} onClick={() => selectStep(index)}>{title}</button>)}
    </nav>

    {step === 0 && <fieldset className="grid gap-2">
      <legend className="mb-1 font-semibold">入会案内を見た人が次にすること</legend>
      {(Object.keys(routes) as Route[]).map(route => <label className="flex gap-2 rounded-lg border p-3 text-sm" key={route}>
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
      <label className="grid gap-1 text-sm font-medium">受講対象
        <select className={field} value={draft.audience} onChange={event => {
          const audience = event.target.value as Draft["audience"];
          setDraft(current => ({ ...current, audience }));
          if (audience !== "both") setFormTab(audience);
        }}>
          <option value="adult">成人のみ</option><option value="minor">未成年のみ</option>
          <option value="both">{audienceLabels.both}</option>
        </select>
      </label>
      {draft.audience === "both" && profileButtons(editing, setFormTab)}
      <fieldset className="grid gap-2 rounded-lg border p-3">
        <legend className="px-1 font-medium">{audienceLabels[editing]}の受講者項目</legend>
        {fieldIds.filter(id => !id.startsWith("guardian")).map(fieldControl)}
        {editForm.rules.school !== "hidden" && <label className="grid gap-1 text-sm">所属欄の表示名
          <input className={field} maxLength={60} value={editForm.schoolLabel} onChange={event => updateForm({ ...editForm, schoolLabel: event.target.value })} />
        </label>}
      </fieldset>
      {editing === "minor" && <fieldset className="grid gap-2 rounded-lg border p-3">
        <legend className="px-1 font-medium">保護者の項目</legend>
        {fieldIds.filter(id => id.startsWith("guardian")).map(fieldControl)}
      </fieldset>}
      <p className="text-sm text-neutral-600">{editing === "minor"
        ? "保護者宛てに受付メールを送り、保護者のPARARIアカウントを申込に紐づけます。"
        : "受講者本人のメール宛てに案内し、本人のPARARIアカウントを申込に紐づけます。"}</p>
    </div>}

    {step === 2 && <div className="grid gap-3">
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
          <label>件名<input className={field} maxLength={180} value={draft.mail[id].subject}
            onChange={event => setDraft({ ...draft, mail: { ...draft.mail, [id]: { ...draft.mail[id], subject: event.target.value } } })} /></label>
          <label>本文<textarea className={field} maxLength={4000} rows={3} value={draft.mail[id].body}
            onChange={event => setDraft({ ...draft, mail: { ...draft.mail, [id]: { ...draft.mail[id], body: event.target.value } } })} /></label>
          <p>差し込み項目　{"{教室名}"} {"{日時}"} {"{会場}"}</p>
        </div>
      </details>)}
    </div>}

    {step === 3 && <div className="mx-auto grid w-full max-w-md gap-3 rounded-xl border p-4">
      <p className="text-sm font-medium">{routes[draft.route]}のプレビュー</p>
      {(phase === "form" || phase === "briefingDate") && draft.introduction &&
        <p className="whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-sm">{draft.introduction}</p>}
      {phase === "briefingDate" && <>
        <ClassBookingCalendar slots={[sampleSlot]} bookingWeeks={4} selected={briefingSlot} onSelect={setBriefingSlot} />
        <button type="button" className={action} disabled={!briefingSlot} onClick={() => setPhase("briefing")}>説明会・体験を予約する（練習）</button>
      </>}
      {phase === "form" && <>
        <h4 className="font-semibold">{schoolName}の入会申込（{audienceLabels[previewing]}）</h4>
        {draft.audience === "both" && profileButtons(previewing, setPreviewTab)}
        <div className="grid gap-2" key={previewing}>
          {fieldIds.filter(id => !id.startsWith("guardian")).map(previewField)}
        </div>
        {minor && <fieldset className="grid gap-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">保護者情報</legend>
          {shownForm.rules.address !== "hidden" && shownForm.rules.guardianAddress !== "hidden" &&
            <label className="text-sm"><input type="checkbox" checked={sameAddress} onChange={event => setSameAddress(event.target.checked)} /> 住所は受講者と同じ</label>}
          {fieldIds.filter(id => id.startsWith("guardian")).map(previewField)}
        </fieldset>}
        <button type="button" className={action} onClick={() => setPhase("received")}>申し込む（練習）</button>
      </>}
      {phase in messages && <div className="grid gap-2">
        <span className="text-xs text-neutral-600">メールの見本{phase === "received" ? minor ? " · 保護者宛て" : " · 申込者宛て" : ""}</span>
        <h4 className="font-semibold">{resolved(draft.mail[phase as Mail].subject)}</h4>
        <p className="whitespace-pre-wrap text-sm">{resolved(draft.mail[phase as Mail].body)}</p>
        {phase === "booked" && draft.route === "onsite" && draft.amount && <p className="text-sm">当日のお支払い　{Number(draft.amount).toLocaleString("ja-JP")}円</p>}
        {phase === "briefing" && <button type="button" className={action} onClick={() => setPhase("invite")}>参加後の入会案内を見る</button>}
        {phase === "invite" && <button type="button" className={action} onClick={() => setPhase("form")}>入会を申し込む</button>}
        {phase === "received" && <button type="button" className={action} onClick={() => setPhase("account")}>{draft.route === "online" ? "支払う" : dateButton}</button>}
        {phase === "paid" && <button type="button" className={action} onClick={() => setPhase("date")}>{dateButton}</button>}
      </div>}
      {phase === "account" && <>
        <h4 className="font-semibold">{minor ? "保護者のPARARI登録・ログイン" : "PARARI登録・ログイン"}</h4>
        <button type="button" className={action} onClick={() => setPhase(draft.route === "online" ? "payment" : "date")}>紐づけ完了後の画面を見る</button>
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
      <button type="button" className={secondary} onClick={persist}>下書きを保存</button>
      {step < steps.length - 1 && <button type="button" className={action} onClick={() => selectStep(step + 1)}>次へ</button>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
    </footer>
  </section>;
}
