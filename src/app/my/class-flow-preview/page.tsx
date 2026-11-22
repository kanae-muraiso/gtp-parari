"use client";

// CLASS A/B process prototype: browser-only state, no Supabase, API writes, or payments.
import { useMemo, useState } from "react";
import Link from "next/link";

type BeforeAdmission = "none" | "briefing" | "trial" | "both";
type PaymentMethod = "card" | "bank" | "cash";
type TimeSlot = { id: string; name: string; weekday: string; startsAt: string; duration: number; capacity: number; occupied: number };
type Service = { id: string; name: string; monthlyFee: number; monthlyVisits: number; slots: TimeSlot[] };
const weekdayOptions = ["月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜"];
const newSlot = (name: string, weekday = "月曜"): TimeSlot => ({
  id: crypto.randomUUID(), name, weekday, startsAt: "16:30", duration: 90, capacity: 6, occupied: 0,
});
type View = "teacher" | "applicant" | "member" | "operator";
type Phase = "intake" | "pre" | "form" | "selection" | "payment" | "complete";

const card = "rounded-2xl border border-neutral-200 bg-white p-5";
const label = "mb-1.5 block text-xs font-semibold text-neutral-600";
const field = "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900";
const secondary = "rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50";
const primary = "rounded-full bg-emerald-800 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-900";
const yen = (value: number) => value.toLocaleString("ja-JP") + "円";

function Track({ steps, active = -1 }: { steps: string[]; active?: number }) {
  return <div className="flex flex-wrap items-center gap-1.5" aria-label="進行順序">
    {steps.map((step, index) => <div key={index} className="flex items-center gap-1.5">
      {index ? <span className="text-neutral-400" aria-hidden>→</span> : null}
      <span className={`rounded-lg px-2.5 py-1.5 text-xs ${active === index ? "bg-emerald-800 font-bold text-white" : "bg-neutral-100 text-neutral-700"}`}>{step}</span>
    </div>)}
  </div>;
}

export default function ClassFlowPreview() {
  const [view, setView] = useState<View>("teacher");
  const [school, setSchool] = useState("サンプル英語教室");
  const [services, setServices] = useState<Service[]>([{
    id: "junior1", name: "中1コース", monthlyFee: 22000, monthlyVisits: 4,
    slots: [
      { id: "monday", name: "月曜クラス", weekday: "月曜", startsAt: "16:30", duration: 90, capacity: 6, occupied: 3 },
      { id: "wednesday", name: "水曜クラス", weekday: "水曜", startsAt: "17:00", duration: 90, capacity: 6, occupied: 2 },
    ],
  }]);
  const [editingServiceId, setEditingServiceId] = useState("junior1");
  const [selectedServiceId, setSelectedServiceId] = useState("junior1");
  const [selectedSlotId, setSelectedSlotId] = useState("monday");
  const editorService = services.find(item => item.id === editingServiceId) ?? services[0];
  const chosenService = services.find(item => item.id === selectedServiceId) ?? services[0];
  const chosenSlot = chosenService?.slots.find(item => item.id === selectedSlotId) ?? chosenService?.slots[0];
  const className = chosenSlot?.name ?? "時間枠未設定";
  const monthlyFee = chosenService?.monthlyFee ?? 0;
  const monthlyVisits = chosenService?.monthlyVisits ?? 0;
  const capacity = chosenSlot?.capacity ?? 0;
  const occupied = chosenSlot?.occupied ?? 0;

  function updateService(id: string, change: Partial<Pick<Service, "name" | "monthlyFee" | "monthlyVisits">>) {
    setServices(current => current.map(item => item.id === id ? { ...item, ...change } : item));
  }
  function updateSlot(serviceId: string, slotId: string, change: Partial<Omit<TimeSlot, "id">>) {
    setServices(current => current.map(service => service.id === serviceId
      ? { ...service, slots: service.slots.map(slot => slot.id === slotId ? { ...slot, ...change } : slot) }
      : service));
  }
  function addService() {
    const id = crypto.randomUUID();
    setServices(current => [...current, { id, name: "新しいサービス", monthlyFee: 0, monthlyVisits: 4, slots: [] }]);
    setEditingServiceId(id);
  }
  function addSlot(serviceId: string) {
    const slot = newSlot("新しい時間枠");
    setServices(current => current.map(service => service.id === serviceId
      ? { ...service, slots: [...service.slots, slot] } : service));
  }
  const [admissionFee, setAdmissionFee] = useState(0);
  const [before, setBefore] = useState<BeforeAdmission>("briefing");
  const [briefingFirst, setBriefingFirst] = useState(true);
  const [approval, setApproval] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("bank");
  const [closeDay, setCloseDay] = useState(9);
  const [makeup, setMakeup] = useState(true);
  const [flexible, setFlexible] = useState(false);
  const [phase, setPhase] = useState<Phase>("intake");
  const [hasJoined, setHasJoined] = useState(false);
  const [classConfirmed, setClassConfirmed] = useState(false);
  const [paymentRecorded, setPaymentRecorded] = useState(false);
  const [selectedClass, setSelectedClass] = useState(false);
  const [requestName, setRequestName] = useState("申込者A");
  const [previewMessage, setPreviewMessage] = useState("");

  const pres = before === "none" ? [] : before === "both"
    ? briefingFirst ? ["説明会を予約・参加", "体験を予約・参加"] : ["体験を予約・参加", "説明会を予約・参加"]
    : [before === "briefing" ? "説明会を予約・参加" : "体験を予約・参加"];
  const available = Math.max(0, capacity - occupied - (classConfirmed && selectedClass ? 1 : 0));
  const admissionSteps = useMemo(() => [
    "募集ページの申込ボタン", ...pres, "入会フォーム",
    ...(approval ? ["先生による承認"] : []),
    ...(admissionFee > 0 ? ["クラス選択・空席確認", "入会金と初回受講料の支払", "入会・クラス参加確定"] : ["入会確定"]),
    "生徒HOME",
  ], [before, briefingFirst, approval, admissionFee]);
  const recurringSteps = [
    `前月${closeDay}日23:59 キャンセル締切`,
    `前月${closeDay + 1}日 翌月の受講枠・請求確定`,
    payMethod === "card" ? "カード決済結果を記録" : payMethod === "bank" ? "銀行振込を確認・入金記録" : "現金受領・入金記録",
    "翌月の授業・カレンダー",
  ];

  function resetApplicant() {
    setPhase("intake");
    setHasJoined(false);
    setClassConfirmed(false);
    setSelectedClass(false);
    setPaymentRecorded(false);
    setPreviewMessage("");
    setView("applicant");
  }
  function advanceBefore() { setPhase("form"); }
  function finishForm() {
    if (admissionFee > 0) setPhase("selection");
    else { setHasJoined(true); setPhase("complete"); }
  }
  function finishPayment() {
    setHasJoined(true); setClassConfirmed(true); setPaymentRecorded(true);
    setPhase("complete");
  }

  return <main className="min-h-screen bg-neutral-100 text-neutral-950">
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/my/manage?tab=class" className="text-sm text-neutral-600 underline underline-offset-4">← クラス管理へ</Link>
        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">設計用プロトタイプ ／ 保存・請求なし</span>
      </div>
      <header className="mt-7">
        <p className="text-xs font-semibold tracking-[.18em] text-emerald-800">PARARI · CLASS A / B</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">教室の準備から、生徒の毎月の利用まで</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-600">
          先生の設定を変えると、入会フローと生徒用HOMEが変わります。これは画面と順番を確かめるための試作品です。
          入力値はこの画面だけで使い、データベースには保存しません。実際の申込・決済・席確保・自動請求は実行されません。
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="試作画面の切替">
        {([["teacher","① 先生が設定"],["applicant","② 申込者の画面"],["member","③ 生徒HOME"],["operator","④ 先生の運営画面"]] as const).map(([id,title]) =>
          <button type="button" role="tab" aria-selected={view === id} key={id} className={view === id ? primary : secondary}
            onClick={() => { setView(id); setPreviewMessage(""); }}>{title}</button>)}
      </div>

      {view === "teacher" ? <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,.9fr)]">
        <div className="space-y-4">
          <section className={card}>
            <h2 className="text-lg font-bold">1. 事業 → サービス → 時間枠</h2>
            <p className="mt-2 text-xs text-neutral-600">料金と月の受講回数はサービス、曜日・時刻・定員はその下の時間枠に設定します。</p>
            <label className="mt-4 block"><span className={label}>① 事業名（教室名）</span>
              <input className={field} value={school} onChange={e => setSchool(e.target.value)} />
            </label>
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">② サービス</h3>
                <button type="button" className={secondary} onClick={addService}>＋ サービスを追加</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {services.map(service => <button key={service.id} type="button"
                  className={editorService?.id === service.id ? primary : secondary}
                  onClick={() => setEditingServiceId(service.id)}>{service.name || "名称未設定"}</button>)}
              </div>
              {editorService ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className={label}>サービス名</span><input className={field} value={editorService.name}
                  onChange={e => updateService(editorService.id, { name: e.target.value })} /></label>
                <label><span className={label}>月謝（円）</span><input className={field} type="number" min="0" max="1000000"
                  value={editorService.monthlyFee} onChange={e => updateService(editorService.id, { monthlyFee: Math.max(0, Number(e.target.value) || 0) })} /></label>
                <label><span className={label}>月の基本受講回数</span><input className={field} type="number" min="1" max="31"
                  value={editorService.monthlyVisits} onChange={e => updateService(editorService.id, { monthlyVisits: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })} /></label>
              </div> : null}
              {editorService ? <div className="mt-5 border-t border-emerald-200 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold">③ {editorService.name || "サービス"}の時間枠</h3>
                  <button type="button" className={secondary} onClick={() => addSlot(editorService.id)}>＋ 時間枠を追加</button>
                </div>
                {!editorService.slots.length ? <p className="mt-3 text-xs text-amber-800">時間枠がまだありません。曜日と開始時刻を設定してください。</p> : null}
                <div className="mt-3 space-y-3">{editorService.slots.map(slot => <div key={slot.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="sm:col-span-2"><span className={label}>時間枠名</span><input className={field} value={slot.name}
                      onChange={e => updateSlot(editorService.id, slot.id, {name:e.target.value})}/></label>
                    <label><span className={label}>曜日</span><select className={field} value={slot.weekday}
                      onChange={e => updateSlot(editorService.id, slot.id, {weekday:e.target.value})}>
                      {weekdayOptions.map(day => <option key={day} value={day}>{day}</option>)}</select></label>
                    <label><span className={label}>開始時刻</span><input className={field} type="time" value={slot.startsAt}
                      onChange={e => updateSlot(editorService.id, slot.id, {startsAt:e.target.value})}/></label>
                    <label><span className={label}>授業時間（分）</span><input className={field} type="number" min="5" max="480" value={slot.duration}
                      onChange={e => updateSlot(editorService.id, slot.id, {duration:Math.max(5,Number(e.target.value)||5)})}/></label>
                    <label><span className={label}>定員</span><input className={field} type="number" min="1" max="100" value={slot.capacity}
                      onChange={e => updateSlot(editorService.id, slot.id, {capacity:Math.max(1,Number(e.target.value)||1)})}/></label>
                    <label><span className={label}>既存の参加者（デモ）</span><input className={field} type="number" min="0" max={slot.capacity} value={slot.occupied}
                      onChange={e => updateSlot(editorService.id, slot.id, {occupied:Math.max(0,Math.min(slot.capacity,Number(e.target.value)||0))})}/></label>
                  </div>
                  <button type="button" className="mt-3 text-xs text-rose-700 underline" onClick={() => {
                    setServices(current => current.map(service => service.id === editorService.id ?
                      {...service, slots:service.slots.filter(item => item.id !== slot.id)} : service));
                  }}>この時間枠を削除</button>
                </div>)}</div>
              </div> : null}
            </div>
            <label className="mt-4 block"><span className={label}>事業全体の入会金（円）</span><input className={field}
              type="number" min="0" max="1000000" value={admissionFee} onChange={e => setAdmissionFee(Math.max(0,Number(e.target.value)||0))} /></label>
            <p className="mt-3 text-xs text-neutral-500">事業名・サービス名・時間枠がそれぞれ独立しているため、同じサービスの曜日違いには料金設定が共通で適用されます。</p>
          </section>
          <section className={card}>
            <h2 className="text-lg font-bold">2. 入会前の手続き</h2>
            <label className="mt-4 block"><span className={label}>説明会・体験の有無</span>
              <select className={field} value={before} onChange={e => setBefore(e.target.value as BeforeAdmission)}>
                <option value="none">なし（直接入会）</option><option value="briefing">説明会のみ</option>
                <option value="trial">体験のみ</option><option value="both">両方実施</option>
              </select>
            </label>
            {before === "both" ? <label className="mt-3 block"><span className={label}>先に実施するもの</span>
              <select className={field} value={briefingFirst ? "briefing" : "trial"} onChange={e => setBriefingFirst(e.target.value === "briefing")}>
                <option value="briefing">説明会 → 体験</option><option value="trial">体験 → 説明会</option>
              </select>
            </label> : null}
            <label className="mt-4 flex items-center gap-3 text-sm"><input type="checkbox" checked={approval} onChange={e => setApproval(e.target.checked)} />運営者の入会承認が必要</label>
            <p className="mt-3 text-xs text-neutral-500">説明会・体験の予約枠や承認画面は既存の部品に接続する想定です。</p>
          </section>
          <section className={card}>
            <h2 className="text-lg font-bold">3. 継続・月謝</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label><span className={label}>翌月分のキャンセル締切（前月）</span><select className={field} value={closeDay} onChange={e => setCloseDay(Number(e.target.value))}>
                {Array.from({length:27},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}日 23:59</option>)}
              </select></label>
              <label><span className={label}>月謝の受領方法</span><select className={field} value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)}>
                <option value="bank">銀行振込（運営者が確認）</option>
                <option value="cash">現金（運営者が記録）</option>
                <option value="card">クレジットカード（自動決済）</option>
              </select></label>
            </div>
            <label className="mt-4 flex items-center gap-3 text-sm"><input type="checkbox" checked={makeup} onChange={e => setMakeup(e.target.checked)} />振替を受け付ける</label>
            <label className="mt-3 flex items-center gap-3 text-sm"><input type="checkbox" checked={flexible} onChange={e => setFlexible(e.target.checked)} />残席への自由参加を受け付ける</label>
            <p className="mt-3 text-xs text-neutral-500">実運用のカード決済には、決済手段の登録・失敗時の処理などが別途必要です。</p>
          </section>
          <button type="button" className={primary} onClick={resetApplicant}>この設定で申込者の画面を試す</button>
        </div>
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className={card}>
            <h2 className="text-lg font-bold">設計図：入会まで</h2>
            <p className="mt-2 text-xs leading-6 text-neutral-600">先生の選択から順番を自動で組み立てます。</p>
            <ol className="mt-4 space-y-2">
              {admissionSteps.map((step,index)=><li className="flex items-center gap-3" key={index}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-900">{index+1}</span>
                <span className="text-sm">{step}</span>
              </li>)}
            </ol>
            <div className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">
              {admissionFee > 0
                ? `入会金${yen(admissionFee)}があるため、先にクラスと必要な支払を確定してから入会が成立します。`
                : "入会金がないため、入会フォーム（必要なら承認）後にHOMEへ進み、クラスはHOMEで選びます。"}
            </div>
          </section>
          <section className={card}>
            <h2 className="text-lg font-bold">設計図：毎月の運営</h2>
            <ol className="mt-3 space-y-2">
              {recurringSteps.map((step,index)=><li className="flex items-start gap-2 text-sm" key={index}><span className="text-emerald-700">●</span>{step}</li>)}
            </ol>
            <p className="mt-3 text-xs leading-6 text-neutral-600">翌月の定期参加枠を先に確定し、残席があれば{makeup ? "振替" : ""}{makeup&&flexible?"・":""}{flexible?"自由参加":""}{!makeup&&!flexible?"追加予約なし":""}を受け付けます。支払状況は予約状態とは別に記録します。</p>
          </section>
        </div>
      </div> : null}

      {view === "applicant" ? <section className={`mt-6 ${card}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">申込者として試す</h2><button className={secondary} onClick={resetApplicant}>最初から試す</button></div>
        <p className="mt-2 text-sm text-neutral-600">募集ページは外部HPでもPARARIでも同じ入口につながります。</p>
        <div className="mt-4"><Track steps={admissionSteps}/></div>
        {phase === "intake" ? <div className="mt-7 space-y-3">
          <h3 className="text-xl font-bold">{school || "教室"}へようこそ</h3>
          <p className="text-sm">入会をご希望の方は、以下からお進みください。</p>
          <button className={primary} onClick={()=>setPhase(pres.length?"pre":"form")}>入会を申し込む</button>
        </div> : null}
        {phase === "pre" ? <div className="mt-7 space-y-3">
          <h3 className="text-lg font-bold">入会前のご案内</h3>
          <Track steps={pres}/>
          <p className="text-sm text-neutral-600">ここでは予約・参加・完了を仮にまとめて進めます。実際の運用では日時の選択と受付完了を扱います。</p>
          <button className={primary} onClick={advanceBefore}>説明会・体験が完了したことにして進む</button>
        </div> : null}
        {phase === "form" ? <div className="mt-7 space-y-4">
          <h3 className="text-lg font-bold">入会フォーム</h3>
          <label className="block"><span className={label}>お名前</span><input className={field} value={requestName} onChange={e=>setRequestName(e.target.value)} /></label>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" defaultChecked />教室の規約・個人情報の取り扱いに同意します（試作）</label>
          {approval ? <p className="rounded-xl bg-amber-50 p-3 text-sm">運営者の承認が必要です。この試作では「承認済み」として次へ進みます。</p> : null}
          <button className={primary} disabled={!requestName.trim()} onClick={finishForm}>{admissionFee>0?"クラス選択へ":"入会を確定する"}</button>
        </div> : null}
        {phase === "selection" ? <div className="mt-7 space-y-4">
          <h3 className="text-lg font-bold">参加クラスを選ぶ</h3>
          <p className="text-sm">{className}／月{monthlyVisits}回／{yen(monthlyFee)} ／ 残り{available}席</p>
          <button disabled={available===0} className={primary} onClick={()=>{setSelectedClass(true);setPhase("payment");}}>
            {available===0?"満席です":"このクラスを選ぶ"}
          </button>
          {available===0?<p className="text-sm text-rose-700">入会金がある場合、参加できるクラスがなければ入会を確定しません。</p>:null}
        </div> : null}
        {phase === "payment" ? <div className="mt-7 space-y-4">
          <h3 className="text-lg font-bold">入会時の支払（シミュレーション）</h3>
          <p className="text-sm">入会金 {yen(admissionFee)} ＋ 初回受講料 {yen(monthlyFee)} ＝ <strong>{yen(admissionFee+monthlyFee)}</strong></p>
          <p className="rounded-lg bg-amber-50 p-3 text-sm">ここでは実際の決済を行いません。現金・振込時の仮受付と入会確定の扱いは実装時に検証します。</p>
          <button className={primary} onClick={finishPayment}>支払確認済みとして入会を確定する</button>
        </div> : null}
        {phase === "complete" ? <div className="mt-7 space-y-4">
          <h3 className="text-xl font-bold">入会手続きが完了しました</h3>
          <p className="text-sm">{requestName}さん、{school}へようこそ。</p>
          <p className="text-sm text-neutral-600">{admissionFee>0?"参加クラスも確定しました。":"参加するクラスは生徒HOMEから選べます。"}</p>
          <button className={primary} onClick={()=>setView("member")}>生徒HOMEへ進む</button>
        </div> : null}
      </section> : null}

      {view === "member" ? <section className={`mt-6 ${card}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs text-emerald-800">生徒用HOME（シミュレーション）</p><h2 className="mt-1 text-xl font-bold">{school}</h2></div>
          <button className={secondary} onClick={resetApplicant}>入会からやり直す</button>
        </div>
        {!hasJoined ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm">まだ入会前です。申込者画面から入会をお試しください。</p> : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 p-4">
            <h3 className="font-bold">クラス</h3>
            <p className="mt-2 text-sm">{classConfirmed? `${className}：参加確定` : `${className}：残り${available}席`}</p>
            <button className={secondary+" mt-3"} disabled={!hasJoined||classConfirmed||available===0}
              onClick={()=>{setSelectedClass(true);setClassConfirmed(true);setPreviewMessage("クラスへの参加を確定しました（試作）。必要な支払は別管理です。");}}>
              {classConfirmed?"参加確定済み":"クラスを選んで参加"}
            </button>
          </div>
          <div className="rounded-xl border border-neutral-200 p-4">
            <h3 className="font-bold">カレンダー</h3>
            <p className="mt-2 text-sm">{classConfirmed?`毎月${monthlyVisits}回の参加予定を表示`:"参加クラスが確定すると予定が表示されます。"}</p>
            <span className="mt-3 block text-xs text-neutral-500">実際の開催日は既存のカレンダーから取得する想定です。</span>
          </div>
          <div className="rounded-xl border border-neutral-200 p-4">
            <h3 className="font-bold">支払</h3>
            <p className="mt-2 text-sm">月謝 {yen(monthlyFee)}／{paymentRecorded?"支払済み":"未払い（デモ）"}</p>
            <p className="mt-2 text-xs text-neutral-500">{payMethod==="card"?"カード決済":payMethod==="bank"?"銀行振込":"現金"} ／ 支払履歴・未納を確認</p>
          </div>
          <div className="rounded-xl border border-neutral-200 p-4">
            <h3 className="font-bold">お知らせ・連絡</h3>
            <p className="mt-2 text-sm">教室からの連絡と、次に行うことを表示</p>
            <p className="mt-2 text-xs text-neutral-500">入会済みの人には募集案内より日々の情報を優先します。</p>
          </div>
        </div>
        {previewMessage ? <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm">{previewMessage}</p> : null}
      </section> : null}

      {view === "operator" ? <section className={`mt-6 ${card}`}>
        <h2 className="text-xl font-bold">運営画面（シミュレーション）</h2>
        <p className="mt-2 text-sm text-neutral-600">クラス・カレンダー・支払は同じ参加記録を異なる角度から表示します。</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-neutral-100 p-4"><p className="text-xs">クラスの残席</p><p className="mt-2 text-2xl font-bold">{available}{classConfirmed&&selectedClass?"（デモ参加＋1）":""}</p></div>
          <div className="rounded-xl bg-neutral-100 p-4"><p className="text-xs">翌月の継続確定</p><p className="mt-2 text-lg font-bold">前月{closeDay+1}日</p></div>
          <div className="rounded-xl bg-neutral-100 p-4"><p className="text-xs">支払方法</p><p className="mt-2 text-lg font-bold">{payMethod==="bank"?"振込":payMethod==="cash"?"現金":"カード"}</p></div>
        </div>
        <div className="mt-5 rounded-xl border border-neutral-200 p-4">
          <h3 className="font-bold">月謝の管理例</h3>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm">{requestName}／翌月分 {yen(monthlyFee)}</p><p className="mt-1 text-xs text-neutral-600">{paymentRecorded?"入金済み":"未入金"}・支払期限：前月末日</p></div>
            {payMethod !== "card" ? <button className={secondary} onClick={()=>setPaymentRecorded(v=>!v)}>{paymentRecorded?"入金記録を取り消す":"入金済みにする"}</button>
              : <span className="text-xs text-neutral-600">カードの決済結果を自動反映（予定）</span>}
          </div>
        </div>
        <p className="mt-4 text-xs text-neutral-500">これらの変更は画面内のダミー状態だけに反映されます。既存名簿や本物の請求には影響しません。</p>
      </section> : null}
    </div>
  </main>;
}
