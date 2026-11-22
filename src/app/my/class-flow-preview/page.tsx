"use client";

// CLASS A/B process prototype: browser-only state, no Supabase, API writes, or payments.
import { useMemo, useState } from "react";
import Link from "next/link";

type BeforeAdmission = "none" | "briefing" | "trial" | "both";
type PaymentMethod = "card" | "bank" | "cash";
const PAYMENT_METHODS: { id: PaymentMethod; label: string; guidance: string }[] = [
  { id: "card", label: "クレジットカード", guidance: "決済結果は自動反映する想定" },
  { id: "bank", label: "銀行振込", guidance: "先生が振込を確認して記録" },
  { id: "cash", label: "現金", guidance: "先生が受領して入金記録" },
];
type TimeSlot = { id: string; name: string; weekday: string; startsAt: string; duration: number; capacity: number; occupied: number; feeOverride: number | null };
type Service = { id: string; name: string; monthlyFee: number; monthlyVisits: number; slots: TimeSlot[] };
type DemoStudent = { id: string; name: string; slotId: string; endsOn: string | null };
type WithdrawalRequest = {
  studentId: string; receivedAt: string; finalDay: string; actor: "guardian" | "student";
  guardianConfirmed: boolean; reason: string; status: "pending" | "approved" | "rejected";
};
function tokyoToday(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(now);
  const part = (kind: string) => parts.find(item => item.type === kind)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}
// If the notice arrives before the monthly deadline, the current month is the
// final billing month. Otherwise the next month is already committed.
function withdrawalFinalDay(receivedAt: string, closeDay: number) {
  const [year, month, day] = receivedAt.split("-").map(Number);
  const finalMonth = day <= closeDay ? month : month + 1;
  return lastDayOfMonth(year, finalMonth);
}
const initialStudents: DemoStudent[] = [
  { id: "learner1", name: "生徒A", slotId: "monday", endsOn: "2027-03-31" },
  { id: "learner2", name: "生徒B", slotId: "monday", endsOn: null },
  { id: "learner3", name: "生徒C", slotId: "monday", endsOn: "2027-03-31" },
  { id: "learner4", name: "生徒D", slotId: "wednesday", endsOn: null },
  { id: "learner5", name: "生徒E", slotId: "wednesday", endsOn: "2027-03-31" },
];
const weekdayOptions = ["月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜"];
const newSlot = (name: string, weekday = "月曜"): TimeSlot => ({
  id: crypto.randomUUID(), name, weekday, startsAt: "16:30", duration: 90, capacity: 6, occupied: 0, feeOverride: null,
});
type View = "teacher" | "applicant" | "member" | "operator";
type Phase = "intake" | "contact" | "pre" | "booking-received" | "awaiting-event" | "awaiting-approval" | "selection" | "payment" | "complete";
type SimulatedNotice = { id: number; target: "teacher" | "student"; subject: string; body: string };

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
  const [students, setStudents] = useState<DemoStudent[]>(initialStudents);
  const [billingMonth, setBillingMonth] = useState("2027-03");
  const [withdrawal, setWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [withdrawalFormOpen, setWithdrawalFormOpen] = useState(false);
  const [withdrawalActor, setWithdrawalActor] = useState<"guardian" | "student">("guardian");
  const [withdrawalReason, setWithdrawalReason] = useState("");
  const [withdrawalChecked, setWithdrawalChecked] = useState(false);
  const [withdrawalStudentId, setWithdrawalStudentId] = useState("learner1");
  const [withdrawalMessage, setWithdrawalMessage] = useState("");
  const [services, setServices] = useState<Service[]>([{
    id: "junior1", name: "中1コース", monthlyFee: 22000, monthlyVisits: 4,
    slots: [
      { id: "monday", name: "月曜クラス", weekday: "月曜", startsAt: "16:30", duration: 90, capacity: 6, occupied: 3, feeOverride: null },
      { id: "wednesday", name: "水曜クラス", weekday: "水曜", startsAt: "17:00", duration: 90, capacity: 6, occupied: 2, feeOverride: null },
    ],
  }]);
  const [editingServiceId, setEditingServiceId] = useState("junior1");
  const [retire, setRetire] = useState<{serviceId: string; slotId?: string} | null>(null);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [manageNotice, setManageNotice] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("junior1");
  const [selectedSlotId, setSelectedSlotId] = useState("monday");
  const editorService = services.find(item => item.id === editingServiceId) ?? services[0];
  const chosenService = services.find(item => item.id === selectedServiceId) ?? services[0];
  const chosenSlot = chosenService?.slots.find(item => item.id === selectedSlotId) ?? chosenService?.slots[0];
  const className = chosenSlot?.name ?? "時間枠未設定";
  const monthlyFee = chosenSlot?.feeOverride ?? chosenService?.monthlyFee ?? 0;
  const monthlyVisits = chosenService?.monthlyVisits ?? 0;
  const capacity = chosenSlot?.capacity ?? 0;
  const feeForSlot = (service: Service, slot: TimeSlot) => slot.feeOverride ?? service.monthlyFee;
  // The summary is computed from current settings: no invoice rows are persisted.
  const isBillable = (student: DemoStudent, month: string) => !student.endsOn || student.endsOn >= month + "-01";
  const billingRows = services.flatMap(service => service.slots.map(slot => ({
    billableCount: students.filter(student => student.slotId === slot.id && isBillable(student, billingMonth)).length,
    id: slot.id, serviceName: service.name, slotName: slot.name,
    amount: feeForSlot(service, slot) * students.filter(student => student.slotId === slot.id && isBillable(student, billingMonth)).length,
    unitPrice: feeForSlot(service, slot), count: slot.occupied,
    inherited: slot.feeOverride === null,
  })));
  const billingTotal = billingRows.reduce((sum, row) => sum + row.amount, 0);
  const occupied = chosenSlot?.occupied ?? 0;

  function updateService(id: string, change: Partial<Pick<Service, "name" | "monthlyFee" | "monthlyVisits">>) {
    setServices(current => current.map(item => item.id === id ? { ...item, ...change } : item));
  }
  function updateSlot(serviceId: string, slotId: string, change: Partial<Omit<TimeSlot, "id" | "occupied">>) {
    setServices(current => current.map(service => service.id === serviceId
      ? { ...service, slots: service.slots.map(slot => slot.id === slotId ? { ...slot, ...change } : slot) }
      : service));
  }
  function beginRetire(serviceId: string, slotId?: string) {
    setRetire({ serviceId, ...(slotId ? { slotId } : {}) });
    setTransferTargetId("");
    setTransferConfirmed(false);
    setManageNotice("");
  }
  function completeRetire() {
    if (!retire) return;
    const sourceService = services.find(service => service.id === retire.serviceId);
    if (!sourceService) return;
    const movingSlots = retire.slotId ? sourceService.slots.filter(slot => slot.id === retire.slotId) : sourceService.slots;
    const movers = movingSlots.reduce((sum, slot) => sum + slot.occupied, 0);
    const destination = services.flatMap(service => service.slots.map(slot => ({ service, slot })))
      .find(item => item.slot.id === transferTargetId);
    if (movers > 0 && (!destination || (!retire.slotId && destination.service.id === retire.serviceId) ||
      !transferConfirmed || destination.slot.capacity - destination.slot.occupied < movers)) {
      setManageNotice("移籍先と空席、料金変更への同意を確認してください。");
      return;
    }
    if (movers > 0 && destination && movingSlots.some(slot => slot.id === destination.slot.id)) {
      setManageNotice("移籍元自身は移籍先にできません。");
      return;
    }
    const removed = new Set(movingSlots.map(slot => slot.id));
    setStudents(current => current.map(student => removed.has(student.slotId) && destination ? {...student, slotId: destination.slot.id} : student));
    setServices(current => current.map(service => {
      if (service.id !== retire.serviceId && service.slots.every(slot => slot.id !== transferTargetId)) return service;
      return { ...service, slots: service.slots
        .filter(slot => !removed.has(slot.id))
        .map(slot => slot.id === transferTargetId ? { ...slot, occupied: slot.occupied + movers } : slot) };
    }).filter(service => retire.slotId || service.id !== retire.serviceId));
    if (removed.has(selectedSlotId)) {
      if (destination) {
        setSelectedServiceId(destination.service.id);
        setSelectedSlotId(destination.slot.id);
      } else {
        const candidate = services.flatMap(service => service.slots.map(slot => ({ service, slot })))
          .find(item => !removed.has(item.slot.id));
        setSelectedServiceId(candidate?.service.id ?? "");
        setSelectedSlotId(candidate?.slot.id ?? "");
      }
      // Do not silently change an applicant's confirmed enrollment.
      if (classConfirmed) {
        setClassConfirmed(false);
        setSelectedClass(false);
        setHasJoined(false);
        setPhase("intake");
      }
    }
    if (!retire.slotId && editingServiceId === retire.serviceId) {
      setEditingServiceId(services.find(service => service.id !== retire.serviceId)?.id ?? "");
    }
    if (allowedSlotIds !== null) {
      setAllowedSlotIds(current => current?.filter(id => !removed.has(id)) ?? null);
    }
    setManageNotice(movers
      ? `移籍シミュレーション：${movers}名を「${destination?.service.name} ＞ ${destination?.slot.name}」へ移しました。`
      : "在籍者0名のため、対象を削除しました（デモ）。");
    setRetire(null);
    setTransferConfirmed(false);
  }
  function renderRetirePanel(serviceId: string, slotId?: string) {
    if (!retire || retire.serviceId !== serviceId || (retire.slotId ?? null) !== (slotId ?? null)) return null;
    return (() => {
              const sourceService = services.find(service => service.id === retire.serviceId);
              const movingSlots = retire.slotId ? sourceService?.slots.filter(slot => slot.id === retire.slotId) ?? [] : sourceService?.slots ?? [];
              const movers = movingSlots.reduce((sum, slot) => sum + slot.occupied, 0);
              const excluded = new Set(movingSlots.map(slot => slot.id));
              const targets = services.filter(service => retire.slotId || service.id !== retire.serviceId).flatMap(service => service.slots
                .filter(slot => !excluded.has(slot.id))
                .map(slot => ({ service, slot })));
              const dest = targets.find(item => item.slot.id === transferTargetId);
              const seats = dest ? dest.slot.capacity - dest.slot.occupied : 0;
              const sourceFees = [...new Set(movingSlots.map(slot => slot.feeOverride ?? sourceService?.monthlyFee ?? 0))];
              const nextFee = dest ? feeForSlot(dest.service, dest.slot) : 0;
              return <section className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4" aria-label="コース・クラスの終了確認">
                <h3 className="font-bold">終了・削除の確認</h3>
                <p className="mt-2 text-sm">対象：{sourceService?.name} ＞ {retire.slotId ? movingSlots[0]?.name : "コース全体（すべての時間枠）"}</p>
                <p className="mt-1 text-sm">在籍者（デモ）：{movers}名</p>
                {movers > 0 ? <div className="mt-4 space-y-3">
                  <p className="text-sm font-semibold">在籍者がいるため、先に全員の移籍先を選んでください。</p>
                  <label className="block"><span className={label}>移籍先のクラス</span>
                    <select className={field} value={transferTargetId} onChange={e=>{setTransferTargetId(e.target.value);setTransferConfirmed(false);}}>
                      <option value="">移籍先を選択</option>
                      {targets.map(item => <option value={item.slot.id} key={item.slot.id}>
                        {item.service.name} ＞ {item.slot.name}（空席{Math.max(0,item.slot.capacity-item.slot.occupied)}名）
                      </option>)}
                    </select>
                  </label>
                  {dest ? <div className="rounded-lg bg-white p-3 text-sm">
                    <p>移籍対象：{movers}名／移籍先の空席：{seats}名</p>
                    <p>現在の月謝：{sourceFees.map(yen).join("・")} → 移籍先の月謝：{yen(nextFee)}</p>
                    {seats < movers ? <p className="mt-2 font-semibold text-rose-700">空席が足りません。移籍できません。</p> : null}
                    <p className="mt-2 text-xs text-neutral-600">本番では生徒ごとに変更の通知・承諾、適用月、予約・振替・請求の精算が必要です。</p>
                  </div> : null}
                  <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={transferConfirmed} onChange={e=>setTransferConfirmed(e.target.checked)} />
                    移籍先の定員・料金の違いを確認しました（デモ）</label>
                </div> : <p className="mt-3 text-sm">在籍者がいないため、すぐに削除できます。</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="rounded-full bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    disabled={movers>0&&(!dest||seats<movers||!transferConfirmed)} onClick={completeRetire}>
                    {movers ? "全員を移籍して旧クラスを終了（デモ）" : "削除する（デモ）"}
                  </button>
                  <button type="button" className={secondary} onClick={()=>setRetire(null)}>やめる</button>
                </div>
              </section>;
            })();

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
  const [allowedMethods, setAllowedMethods] = useState<PaymentMethod[]>(["bank", "cash", "card"]);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("bank");
  const paymentOptions = PAYMENT_METHODS.filter(item => allowedMethods.includes(item.id));
  const methodLabel = PAYMENT_METHODS.find(item => item.id === payMethod)?.label ?? "未選択";
  function toggleMethod(method: PaymentMethod) {
    const next = allowedMethods.includes(method) ? allowedMethods.filter(item => item !== method) : [...allowedMethods, method];
    if (!next.length) return;
    setAllowedMethods(next);
    if (!next.includes(payMethod)) { setPayMethod(PAYMENT_METHODS.find(item => next.includes(item.id))!.id); setPaymentRecorded(false); }
  }
  function selectMethod(method: PaymentMethod) {
    if (!allowedMethods.includes(method)) return;
    if (payMethod !== method) { setPayMethod(method); setPaymentRecorded(false); }
  }
  const [closeDay, setCloseDay] = useState(9);
  const todayJst = tokyoToday(new Date());
  const estimatedWithdrawalFinalDay = withdrawalFinalDay(todayJst, closeDay);
  const [makeup, setMakeup] = useState(true);
  const [flexible, setFlexible] = useState(false);
  const [phase, setPhase] = useState<Phase>("intake");
  const [hasJoined, setHasJoined] = useState(false);
  const [classConfirmed, setClassConfirmed] = useState(false);
  const [paymentRecorded, setPaymentRecorded] = useState(false);
  const [selectedClass, setSelectedClass] = useState(false);
  const [requestName, setRequestName] = useState("申込者A");
  const [requestEmail, setRequestEmail] = useState("student@example.com");
  const [requestPhone, setRequestPhone] = useState("");
  const [consented, setConsented] = useState(false);
  const [bookingDate, setBookingDate] = useState("2026-12-05");
  const [bookingTime, setBookingTime] = useState("10:00");
  const [bookingIndex, setBookingIndex] = useState(0);
  const [bookingRecorded, setBookingRecorded] = useState(false);
  const [eventAttended, setEventAttended] = useState(false);
  const [approvalGranted, setApprovalGranted] = useState(false);
  const [allowedSlotIds, setAllowedSlotIds] = useState<string[] | null>(null);
  const [noticeLog, setNoticeLog] = useState<SimulatedNotice[]>([]);
  const [enrollmentSubmitted, setEnrollmentSubmitted] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");

  const pres = before === "none" ? [] : before === "both"
    ? briefingFirst ? ["説明会を予約・参加", "体験を予約・参加"] : ["体験を予約・参加", "説明会を予約・参加"]
    : [before === "briefing" ? "説明会を予約・参加" : "体験を予約・参加"];
  const available = Math.max(0, capacity - occupied - (classConfirmed && selectedClass ? 1 : 0));
  const serviceOptions = services.filter(service => service.slots.length > 0);
  const admissionSteps = useMemo(() => [
    "紹介・申込ボタン", "連絡先・申込フォーム",
    ...(pres.length ? [...pres, "予約受付画面・確認メール", "当日の参加"] : []),
    ...(approval || pres.length ? ["先生の入会許可・クラス制限"] : []),
    "参加サービス・時間枠選択",
    ...(admissionFee > 0 ? ["入会金・受講料の支払確認"] : ["必要な支払案内"]),
    "受付完了・クラス案内メール", "生徒HOME",
  ], [before, briefingFirst, approval, admissionFee]);
  const recurringSteps = [
    `前月${closeDay}日23:59 キャンセル締切`,
    `前月${closeDay + 1}日 翌月の受講枠・請求確定`,
    "生徒の選択：" + methodLabel,
    payMethod === "card" ? "カード決済結果を記録" : payMethod === "bank" ? "銀行振込を確認・入金記録" : "現金受領・入金記録",
    "翌月の授業・カレンダー",
  ];

  function addNotice(target: "teacher" | "student", subject: string, body: string) {
    setNoticeLog(current => [...current, { id: current.length + 1, target, subject, body }]);
  }

  const allSlots = services.flatMap(service => service.slots.map(slot => ({ service, slot })));
  const permittedServices = services.map(service => ({
    ...service, slots: service.slots.filter(slot => allowedSlotIds === null || allowedSlotIds.includes(slot.id)),
  })).filter(service => service.slots.length > 0);

  function submitWithdrawal() {
    if (withdrawal || !withdrawalChecked) return;
    const person = students.find(student => student.id === withdrawalStudentId);
    if (!person) return;
    const finalDay = estimatedWithdrawalFinalDay;
    const request: WithdrawalRequest = {
      studentId: person.id, receivedAt: todayJst, finalDay, actor: withdrawalActor,
      guardianConfirmed: withdrawalActor === "guardian", reason: withdrawalReason.trim(), status: "pending",
    };
    setWithdrawal(request);
    setWithdrawalFormOpen(false);
    setWithdrawalChecked(false);
    setWithdrawalMessage("退会届を受け付けました。まだ退会は確定していません。先生による確認が必要です。");
    addNotice("student", "退会届の受付", `${person.name}様の届出を${todayJst}に受け付けました。最終受講予定日は${finalDay}です。先生の確認をお待ちください。`);
    addNotice("teacher", "退会届の確認依頼", `${person.name}様の退会届（${withdrawalActor === "guardian" ? "保護者から" : "生徒本人から"}）が届きました。最終受講予定日：${finalDay}。`);
  }
  function confirmWithdrawalGuardian() {
    if (!withdrawal || withdrawal.status !== "pending") return;
    setWithdrawal({...withdrawal, guardianConfirmed:true});
    setWithdrawalMessage("保護者による確認を受け付けました。先生の確定操作をお待ちください。");
    addNotice("teacher", "保護者による退会届確認", "保護者による退会届の確認が完了しました。");
  }
  function decideWithdrawal(approved: boolean) {
    if (!withdrawal || withdrawal.status !== "pending") return;
    if (approved && !withdrawal.guardianConfirmed) {
      setWithdrawalMessage("未成年者の退会届は、保護者の確認がない状態では確定できません。");
      return;
    }
    if (approved) {
      setStudents(current => current.map(student => student.id === withdrawal.studentId
        ? {...student, endsOn: student.endsOn && student.endsOn < withdrawal.finalDay ? student.endsOn : withdrawal.finalDay}
        : student));
    }
    setWithdrawal({...withdrawal,status: approved ? "approved" : "rejected"});
    setWithdrawalMessage(approved ? "先生が退会を確定しました。最終受講日の翌月以降は定期月謝の試算から外れます。" : "退会届は見送りになりました。既存の受講契約は変わりません。");
    addNotice("student", approved ? "退会日の確定" : "退会届についてのご連絡",
      approved ? `最終受講日：${withdrawal.finalDay}として先生が確認しました。` : "先生が届出内容について確認を求めています。教室にお問い合わせください。");
  }
  function resetWithdrawalDemo() {
    setWithdrawal(null); setWithdrawalFormOpen(false); setWithdrawalMessage(""); setWithdrawalChecked(false); setWithdrawalReason("");
  }
  function resetApplicant() {
    const first = serviceOptions[0];
    if (first) {
      setSelectedServiceId(first.id);
      setSelectedSlotId(first.slots[0].id);
    }
    setPhase("intake");
    setHasJoined(false);
    setClassConfirmed(false);
    setSelectedClass(false);
    setPaymentRecorded(false);
    setBookingRecorded(false);
    setEventAttended(false);
    setApprovalGranted(false);
    setAllowedSlotIds(null);
    setNoticeLog([]);
    setBookingIndex(0);
    setEnrollmentSubmitted(false);
    setConsented(false);
    setPreviewMessage("");
    setView("applicant");
  }
  function submitContact() {
    if (!requestName.trim() || !/^\S+@\S+\.\S+$/.test(requestEmail.trim()) || !consented) return;
    if (pres.length) setPhase("pre");
    else if (approval) {
      setPhase("awaiting-approval");
      addNotice("teacher", "入会希望者の申込", `${requestName}さんから申込がありました。承認してください。`);
    } else {
      setApprovalGranted(true);
      setPhase("selection");
    }
  }
  function reserveEvent() {
    if (!bookingDate || !bookingTime) return;
    setBookingRecorded(true);
    addNotice("student", "説明会・体験の予約受付", `${requestName}様：${pres[bookingIndex]}を${bookingDate} ${bookingTime}で受け付けました。`);
    addNotice("teacher", "説明会・体験の予約通知", `${requestName}様（${requestEmail}）より${bookingDate} ${bookingTime}の申込がありました。`);
    setPhase("booking-received");
  }
  function advanceBookedEvent() {
    if (bookingIndex < pres.length - 1) {
      setBookingIndex(index => index + 1);
      setPhase("pre");
    } else {
      setPhase("awaiting-event");
    }
  }
  function markEventAttended() {
    setEventAttended(true);
    setPhase("awaiting-approval");
  }
  function grantApproval() {
    if (pres.length && !eventAttended) {
      setPreviewMessage("説明会・体験の参加確認後に入会を許可してください。");
      return;
    }
    const firstAllowed = allSlots.find(({slot}) => allowedSlotIds === null || allowedSlotIds.includes(slot.id));
    if (!firstAllowed) { setPreviewMessage("選択できる時間枠がありません。許可するクラスを確認してください。"); return; }
    setSelectedServiceId(firstAllowed.service.id);
    setSelectedSlotId(firstAllowed.slot.id);
    setApprovalGranted(true);
    addNotice("student", "入会が許可されました", `${school}への入会が許可されました。ご案内の画面から参加クラスをお選びください。`);
    setPhase("selection");
    setView("applicant");
  }
  function submitSelection() {
    if (!chosenSlot || available <= 0 || !approvalGranted) return;
    if (allowedSlotIds !== null && !allowedSlotIds.includes(chosenSlot.id)) return;
    setSelectedClass(true);
    setEnrollmentSubmitted(true);
    if (admissionFee > 0) setPhase("payment");
    else finishEnrollment(false);
  }
  function finishEnrollment(paid: boolean) {
    setHasJoined(true);
    setClassConfirmed(true);
    setPaymentRecorded(paid);
    setPhase("complete");
    addNotice("student", "クラス受付完了・参加のご案内", `${chosenService?.name} ＞ ${className} を受け付けました。月謝 ${yen(monthlyFee)}、支払方法は ${methodLabel} です。`);
    addNotice("teacher", "新しいクラス参加受付", `${requestName}様が${chosenService?.name} ＞ ${className}を申し込みました（支払状態：${paid ? "確認済み" : "未払い"}）。`);
  }
  function finishPayment() { finishEnrollment(true); }

  return <main className="min-h-screen bg-neutral-100 text-neutral-950">
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/my/manage?tab=class" className="text-sm text-neutral-600 underline underline-offset-4">← クラス管理へ</Link>
        <Link href="/my/class-setup-wizard-preview" className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900">先生の設定を一問ずつ進める</Link>
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
            <p className="mt-2 text-xs text-neutral-600">月謝はサービスで設定し、時間枠は原則継承。人数は名簿から計算するため、設定画面では変更できません。請求・入金は事業全体でまとめます。</p>
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
              {editorService ? <div className="mt-4">
                <button type="button" className="text-xs text-rose-700 underline" onClick={() => beginRetire(editorService.id)}>
                  このサービス（コース）を終了・削除
                </button>
                {renderRetirePanel(editorService.id)}
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
                    <div><span className={label}>現在の在籍者数（自動集計）</span>
                      <div className="rounded-xl border border-neutral-200 bg-neutral-100 px-3 py-2.5 text-sm font-semibold" aria-readonly="true">{slot.occupied}名 <span className="ml-2 text-xs font-normal text-neutral-500">変更不可・名簿で管理</span></div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl bg-neutral-50 p-3">
                    <p className="text-xs font-semibold text-neutral-700">この時間枠の月謝設定</p>
                    <label className="mt-3 flex items-center gap-2 text-sm">
                      <input type="radio" name={`fee-${slot.id}`} checked={slot.feeOverride === null}
                        onChange={() => updateSlot(editorService.id, slot.id, { feeOverride: null })}/>
                      サービスの月謝を適用（{yen(editorService.monthlyFee)}）
                    </label>
                    <label className="mt-2 flex items-center gap-2 text-sm">
                      <input type="radio" name={`fee-${slot.id}`} checked={slot.feeOverride !== null}
                        onChange={() => updateSlot(editorService.id, slot.id, { feeOverride: editorService.monthlyFee })}/>
                      この時間枠だけ個別に設定
                    </label>
                    {slot.feeOverride !== null ? <label className="mt-3 block">
                      <span className={label}>個別月謝（税込・円）</span>
                      <input className={field} type="number" min="0" max="1000000" value={slot.feeOverride}
                        onChange={e => updateSlot(editorService.id, slot.id, { feeOverride: Math.max(0,Math.min(1000000,Number(e.target.value)||0)) })}/>
                    </label> : null}
                    <p className="mt-3 text-sm font-semibold">適用月謝：{yen(feeForSlot(editorService,slot))}</p>
                  </div>
                  <button type="button" className="mt-3 text-xs text-rose-700 underline"
                    onClick={() => beginRetire(editorService.id, slot.id)}>この時間枠を終了・削除</button>
                  {renderRetirePanel(editorService.id, slot.id)}
                </div>)}</div>
              </div> : null}
            </div>
            {manageNotice ? <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm">{manageNotice}</p> : null}
            <label className="mt-4 block"><span className={label}>事業全体の入会金（円）</span><input className={field}
              type="number" min="0" max="1000000" value={admissionFee} onChange={e => setAdmissionFee(Math.max(0,Number(e.target.value)||0))} /></label>
            <p className="mt-3 text-xs text-neutral-500">サービスの月謝を変更すると、継承している時間枠にはすぐ反映されます。個別料金を設定した時間枠は影響を受けません。</p>
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
              <div className="sm:col-span-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className={label}>この事業で受け付ける集金方法（複数選択可能）</p>
                <p className="mb-3 text-xs text-neutral-600">先生が対応可能な方法を指定し、生徒がその中から選びます。</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {PAYMENT_METHODS.map(method => <label className="flex items-center gap-2 text-sm" key={method.id}>
                    <input type="checkbox" checked={allowedMethods.includes(method.id)} onChange={() => toggleMethod(method.id)} />
                    {method.label}
                  </label>)}
                </div>
                <p className="mt-3 text-xs text-neutral-500">最低1種類を残してください。生徒の選択は運営画面にも表示します。</p>
              </div>
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">申込者として試す</h2>
          <button className={secondary} onClick={resetApplicant}>最初から試す</button>
        </div>
        <p className="mt-2 text-sm text-neutral-600">募集ページは外部HPでもPARARIでも同じ申込入口へ。画面内の案内やメールはすべてダミーです。</p>
        <div className="mt-4"><Track steps={admissionSteps}/></div>
        {phase === "intake" ? <div className="mt-7 space-y-4">
          <h3 className="text-xl font-bold">{school || "教室"}へようこそ</h3>
          <p className="text-sm leading-7 text-neutral-700">授業の内容や教室の考え方をご覧ください。ご興味がある方は以下からお申し込みいただけます。</p>
          <button className={primary} onClick={()=>setPhase("contact")}>入会を申し込む</button>
        </div> : null}
        {phase === "contact" ? <div className="mt-7 space-y-4">
          <h3 className="text-lg font-bold">申込フォーム・連絡先</h3>
          <p className="text-sm text-neutral-600">連絡先を登録すると、必要な場合は説明会・体験の予約へ進みます。</p>
          <label className="block"><span className={label}>お名前</span><input className={field} value={requestName} onChange={e=>setRequestName(e.target.value)} /></label>
          <label className="block"><span className={label}>メールアドレス</span><input className={field} type="email" value={requestEmail} onChange={e=>setRequestEmail(e.target.value)} /></label>
          <label className="block"><span className={label}>電話番号（任意）</span><input className={field} type="tel" value={requestPhone} onChange={e=>setRequestPhone(e.target.value)} /></label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={consented} onChange={e=>setConsented(e.target.checked)} />教室の規約と個人情報の取り扱いに同意する（デモ）</label>
          {!requestName.trim() ? <p role="status" className="text-sm text-amber-800">お名前を入力してください。</p> : null}
          {requestName.trim() && !/^\S+@\S+\.\S+$/.test(requestEmail.trim()) ? <p role="status" className="text-sm text-amber-800">正しいメールアドレスを入力してください。</p> : null}
          {requestName.trim() && /^\S+@\S+\.\S+$/.test(requestEmail.trim()) && !consented ? <p role="status" className="text-sm text-amber-800">規約・個人情報の取り扱いへの同意にチェックしてください。</p> : null}
          <button className={primary+" disabled:cursor-not-allowed disabled:opacity-40"} disabled={!requestName.trim()||!/^\S+@\S+\.\S+$/.test(requestEmail.trim())||!consented} onClick={submitContact}>申込内容を送信して次へ</button>
        </div> : null}
        {phase === "pre" ? <div className="mt-7 space-y-4">
          <h3 className="text-lg font-bold">{pres[bookingIndex]}の予約</h3>
          <p className="text-sm text-neutral-600">空き日時を選んで予約してください。今回は日時候補を仮表示しています。</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className={label}>参加日</span><select className={field} value={bookingDate} onChange={e=>setBookingDate(e.target.value)}>
              <option value="2026-12-05">12月5日（土）</option><option value="2026-12-12">12月12日（土）</option>
              <option value="2026-12-19">12月19日（土）</option>
            </select></label>
            <label><span className={label}>開始時刻</span><select className={field} value={bookingTime} onChange={e=>setBookingTime(e.target.value)}>
              <option value="10:00">10:00</option><option value="14:00">14:00</option><option value="17:00">17:00</option>
            </select></label>
          </div>
          <button className={primary} onClick={reserveEvent}>この日時で予約する</button>
        </div> : null}
        {phase === "booking-received" ? <div className="mt-7 space-y-4">
          <h3 className="text-xl font-bold">予約を受け付けました</h3>
          <p className="text-sm">{pres[bookingIndex]}：{bookingDate} {bookingTime}</p>
          <div className="rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-950">
            お申込者への確認メールと、先生への予約通知を作成しました（この画面内だけ）。
          </div>
          <button className={primary} onClick={advanceBookedEvent}>
            {bookingIndex < pres.length - 1 ? "次の説明会・体験を予約する" : "当日の参加へ進む"}
          </button>
        </div> : null}
        {phase === "awaiting-event" ? <div className="mt-7 space-y-4">
          <h3 className="text-lg font-bold">当日：説明会・体験</h3>
          <p className="text-sm">予約日時に参加します。終了後、先生が参加・入会許可を確認します。</p>
          <button className={secondary} onClick={()=>{setView("operator");setPreviewMessage("先生側で説明会・体験の参加と入会許可を処理してください。");}}>先生の運営画面で受付を処理する</button>
        </div> : null}
        {phase === "awaiting-approval" ? <div className="mt-7 space-y-4">
          <h3 className="text-lg font-bold">入会の許可を確認しています</h3>
          <p className="text-sm">先生が許可すると、選択可能なサービス・時間枠の案内が表示されます。</p>
          <button className={secondary} onClick={()=>{setView("operator");setPreviewMessage("先生側で入会の許可と、必要なら参加クラスの制限を設定してください。");}}>先生の運営画面へ</button>
        </div> : null}
        {phase === "selection" ? <div className="mt-7 space-y-4">
          <h3 className="text-lg font-bold">入会許可・参加クラスの選択</h3>
          <p className="text-sm text-emerald-800">入会可能です。以下から参加クラスを選択してください。</p>
          <label className="block"><span className={label}>サービス</span>
            <select className={field} value={permittedServices.some(x=>x.id===selectedServiceId)?selectedServiceId:permittedServices[0]?.id??""} onChange={e=>{
              const service=permittedServices.find(item=>item.id===e.target.value);
              if(service){setSelectedServiceId(service.id);setSelectedSlotId(service.slots[0]?.id??"");}
            }}>{permittedServices.map(service=><option key={service.id} value={service.id}>{service.name}／月{service.monthlyVisits}回</option>)}</select>
          </label>
          <label className="block"><span className={label}>時間枠</span>
            <select className={field} value={chosenSlot?.id??""} onChange={e=>setSelectedSlotId(e.target.value)}>
              {permittedServices.find(x=>x.id===selectedServiceId)?.slots.map(slot=><option key={slot.id} value={slot.id}>
                {slot.name}／{slot.weekday} {slot.startsAt}／{yen(feeForSlot(chosenService,slot))}／空席{Math.max(0,slot.capacity-slot.occupied)}
              </option>)}
            </select>
          </label>
          <p className="text-sm">選択中：{school} ＞ {chosenService?.name} ＞ {className}／{yen(monthlyFee)}</p>
          <button className={primary} disabled={!chosenSlot||available<=0||(allowedSlotIds!==null&&!allowedSlotIds.includes(chosenSlot.id))}
            onClick={submitSelection}>{available<=0?"満席です":"このクラスを申し込む"}</button>
        </div> : null}
        {phase === "payment" ? <div className="mt-7 space-y-4">
          <h3 className="text-lg font-bold">入会金と受講料</h3>
          <p className="text-sm">入会金 {yen(admissionFee)} ＋ 初回受講料 {yen(monthlyFee)} ＝ <strong>{yen(admissionFee+monthlyFee)}</strong></p>
          <fieldset className="space-y-2"><legend className="text-sm font-bold">支払方法</legend>
            {paymentOptions.map(method=><label key={method.id} className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-sm">
              <input type="radio" name="admission-payment-method" checked={payMethod===method.id} onChange={()=>selectMethod(method.id)} />
              <span><strong>{method.label}</strong><span className="block text-xs text-neutral-500">{method.guidance}</span></span>
            </label>)}
          </fieldset>
          <p className="rounded-xl bg-amber-50 p-3 text-sm">実際の支払・決済はしません。入会金のある教室は、必要な支払が確認されるまで正式入会にはしない設計です。</p>
          <button className={primary} onClick={finishPayment}>支払確認済みとして入会を確定する（デモ）</button>
        </div> : null}
        {phase === "complete" ? <div className="mt-7 space-y-4">
          <h3 className="text-xl font-bold">クラス受付・入会完了</h3>
          <p className="text-sm">{requestName}さん、{school}へようこそ。</p>
          <p className="text-sm">{chosenService?.name} ＞ {className}／支払：{paymentRecorded?"確認済み":"未払い・別途ご案内"}</p>
          <p className="rounded-xl bg-emerald-50 p-3 text-sm">参加クラスの案内メールを作成し、先生の受付・支払一覧にも反映しました（デモ）。</p>
          <div className="rounded-xl border border-neutral-200 p-4 text-sm">
            <p className="font-bold">生徒HOMEについて</p>
            <p className="mt-2 leading-7">次回の授業、クラス予約、カレンダー、月謝の支払状況、先生からの連絡をまとめて確認できます。</p>
          </div>
          <button className={primary} onClick={()=>setView("member")}>生徒HOMEへ進む</button>
        </div> : null}
        {noticeLog.some(x=>x.target==="student") ? <details className="mt-7 rounded-xl border border-neutral-200 p-4">
          <summary className="cursor-pointer text-sm font-bold">申込者に届くメール（デモ）</summary>
          <div className="mt-3 space-y-2">{noticeLog.filter(x=>x.target==="student").map(item=><div key={item.id} className="rounded-lg bg-neutral-50 p-3 text-xs">
            <p className="font-bold">{item.subject}</p><p className="mt-1 whitespace-pre-wrap">{item.body}</p>
          </div>)}</div>
        </details> : null}
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
            <p className="mt-2 text-sm">所属：{school}</p>
            {!classConfirmed ? <div className="mt-3 space-y-2">
              <label className="block"><span className={label}>サービスを選ぶ</span>
                <select className={field} value={chosenService?.id ?? ""} onChange={e => {
                  const service=services.find(item=>item.id===e.target.value);
                  if (service) {setSelectedServiceId(service.id);setSelectedSlotId(service.slots[0]?.id??"");}
                }}>{services.map(service=><option key={service.id} value={service.id}>{service.name}／{yen(service.monthlyFee)}</option>)}</select>
              </label>
              <label className="block"><span className={label}>時間枠を選ぶ</span>
                <select className={field} value={chosenSlot?.id ?? ""} onChange={e=>setSelectedSlotId(e.target.value)}>
                  {!chosenService?.slots.length ? <option value="">時間枠がありません</option> : null}
                  {chosenService?.slots.map(slot=><option key={slot.id} value={slot.id}>{slot.name}（{slot.weekday} {slot.startsAt}・{yen(feeForSlot(chosenService,slot))}・残り{Math.max(0,slot.capacity-slot.occupied)}席）</option>)}
                </select>
              </label>
            </div> : null}
            <p className="mt-2 text-sm">{chosenService?.name} ＞ {classConfirmed? `${className}：参加確定` : `${className}：残り${available}席`}</p>
            <button className={secondary+" mt-3"} disabled={!hasJoined||classConfirmed||!chosenSlot||available===0}
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
            <label className="mt-3 block"><span className={label}>支払方法を選ぶ</span>
              <select className={field} value={payMethod} disabled={!hasJoined}
                onChange={e => selectMethod(e.target.value as PaymentMethod)}>
                {paymentOptions.map(method => <option value={method.id} key={method.id}>{method.label}</option>)}
              </select>
            </label>
            <p className="mt-2 text-xs text-neutral-500">先生が受け付ける方法だけを選べます。変更後の適用月は本実装時に定義します。</p>
          </div>
          <div className="rounded-xl border border-neutral-200 p-4">
            <h3 className="font-bold">お知らせ・連絡</h3>
            <p className="mt-2 text-sm">教室からの連絡と、次に行うことを表示</p>
            <p className="mt-2 text-xs text-neutral-500">入会済みの人には募集案内より日々の情報を優先します。</p>
          </div>
        </div>
        <section className="mt-5 rounded-xl border border-neutral-200 p-4">
          <h3 className="font-bold">クラスの欠席・退会手続き</h3>
          <p className="mt-2 text-sm text-neutral-600">一回の欠席・振替はカレンダーで連絡します。クラスをやめる場合は「退会届」を提出します。</p>
          {!withdrawal && <button className={secondary+" mt-3"} onClick={()=>{setWithdrawalFormOpen(value=>!value);setWithdrawalMessage("");}}>退会届を提出する</button>}
          {!withdrawal && withdrawalFormOpen && <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h4 className="font-semibold">退会届</h4>
            <label className="block"><span className={label}>対象となる生徒（デモ名簿）</span>
              <select className={field} value={withdrawalStudentId} onChange={e=>setWithdrawalStudentId(e.target.value)}>
                {students.map(student=><option key={student.id} value={student.id}>{student.name}</option>)}
              </select>
            </label>
            <fieldset className="space-y-2"><legend className={label}>届け出る方</legend>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="withdrawalActor" checked={withdrawalActor==="guardian"} onChange={()=>setWithdrawalActor("guardian")}/>保護者</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="withdrawalActor" checked={withdrawalActor==="student"} onChange={()=>setWithdrawalActor("student")}/>生徒本人（保護者の確認が別途必要）</label>
            </fieldset>
            <label className="block"><span className={label}>連絡事項（任意）</span><textarea className={field} rows={2} maxLength={500} value={withdrawalReason} onChange={e=>setWithdrawalReason(e.target.value)}/></label>
            <div className="rounded-xl bg-white p-3 text-sm">
              <p>届出受付日（日本時間）：<strong>{todayJst}</strong></p>
              <p>事業の締切：毎月{closeDay}日 23:59</p>
              <p className="mt-2">自動計算された最終受講予定日：<strong>{estimatedWithdrawalFinalDay}</strong></p>
              <p className="mt-2 text-xs text-neutral-600">締切後は翌月の受講枠が確定しているため、その翌月末が最終受講日になります。届出を送っても先生の承認前には退会は確定しません。</p>
            </div>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={withdrawalChecked} onChange={e=>setWithdrawalChecked(e.target.checked)}/>
              最終受講予定日と、先生による確認が必要なことを理解しました</label>
            <div className="flex flex-wrap gap-2"><button className={primary+" disabled:opacity-40"} disabled={!withdrawalChecked} onClick={submitWithdrawal}>退会届を送信する（デモ）</button>
              <button className={secondary} onClick={()=>setWithdrawalFormOpen(false)}>閉じる</button></div>
          </div>}
          {withdrawal && <div className="mt-3 space-y-2 rounded-xl bg-neutral-50 p-3 text-sm">
            <p className="font-semibold">届出：{withdrawal.status==="pending"?"受付済み・先生確認待ち":withdrawal.status==="approved"?"先生確認済み・退会日確定":"確認・相談が必要"}</p>
            <p>届出受付日：{withdrawal.receivedAt}／最終受講予定日：{withdrawal.finalDay}</p>
            <p>保護者確認：{withdrawal.guardianConfirmed?"確認済み":"未確認"}</p>
            {withdrawal.status==="pending" && !withdrawal.guardianConfirmed &&
              <button className={secondary} onClick={confirmWithdrawalGuardian}>保護者が確認する（デモ）</button>}
            {withdrawal.status!=="pending" && <button className={secondary} onClick={resetWithdrawalDemo}>別の届出を試す</button>}
          </div>}
          {withdrawalMessage && <p role="status" className="mt-3 text-sm text-emerald-900">{withdrawalMessage}</p>}
          <p className="mt-3 text-xs text-neutral-500">本番では保護者自身の認証・同意の記録を確認します。この画面の保護者確認ボタンは試作用です。</p>
        </section>
        {previewMessage ? <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm">{previewMessage}</p> : null}
      </section> : null}

      {view === "operator" ? <section className={`mt-6 ${card}`}>
        <h2 className="text-xl font-bold">運営画面（シミュレーション）</h2>
        <p className="mt-2 text-sm text-neutral-600">事業内のサービスと時間枠をまとめて管理します。クラス・カレンダー・支払は同じ参加記録の表示です。</p>
        <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
          <h3 className="font-bold">入会希望者の受付・承認（デモ）</h3>
          <p className="mt-1 text-xs text-neutral-600">{requestName}／{requestEmail}{requestPhone ? "／"+requestPhone : ""}</p>
          <p className="mt-2 text-sm">状態：{hasJoined ? "入会・クラス確定" : approvalGranted ? "入会許可済み・クラス選択待ち" : phase==="awaiting-event" ? "説明会・体験の参加待ち" : phase==="awaiting-approval" ? "入会許可待ち" : bookingRecorded ? "予約受付済み" : "申込受付前"}</p>
          {pres.length > 0 ? <p className="mt-2 text-xs text-neutral-600">説明会・体験：{bookingRecorded ? "予約あり" : "予約前"}／{eventAttended ? "参加確認済み" : "参加未確認"}</p> : null}
          {phase === "awaiting-event" ? <button className={secondary+" mt-3"} onClick={markEventAttended}>当日の参加を確認する</button> : null}
          {phase === "awaiting-approval" ? <div className="mt-4 space-y-3">
            <p className="text-sm font-semibold">参加を許可する時間枠</p>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="approval-slots" checked={allowedSlotIds===null} onChange={()=>setAllowedSlotIds(null)} />すべての時間枠を許可</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="approval-slots" checked={allowedSlotIds!==null} onChange={()=>setAllowedSlotIds(allSlots.map(({slot})=>slot.id))}/>時間枠を制限する</label>
            {allowedSlotIds!==null ? <div className="space-y-2 rounded-lg bg-white p-3">
              {allSlots.map(({service,slot})=><label className="flex items-center gap-2 text-sm" key={slot.id}>
                <input type="checkbox" checked={allowedSlotIds.includes(slot.id)} onChange={e=>setAllowedSlotIds(ids=>e.target.checked?[...(ids??[]),slot.id]:(ids??[]).filter(id=>id!==slot.id))}/>
                {service.name} ＞ {slot.name}（残り{Math.max(0,slot.capacity-slot.occupied)}席）
              </label>)}
            </div> : null}
            <button className={primary} disabled={allowedSlotIds!==null&&allowedSlotIds.length===0} onClick={grantApproval}>入会を許可してクラス選択画面へ</button>
          </div> : null}
          {enrollmentSubmitted ? <div className="mt-4 rounded-lg bg-white p-3 text-sm">
            <p className="font-bold">申込結果</p>
            <p>{chosenService?.name} ＞ {className}</p>
            <p>クラス：{classConfirmed?"受付確定":"支払待ち"} ／ 支払：{paymentRecorded?"確認済み":"未払い"}</p>
          </div> : null}
          {noticeLog.some(item=>item.target==="teacher") ? <details className="mt-4 rounded-xl bg-white p-3">
            <summary className="cursor-pointer text-sm font-bold">先生に届く通知（デモ・{noticeLog.filter(item=>item.target==="teacher").length}件）</summary>
            <div className="mt-3 space-y-2">
              {noticeLog.filter(item=>item.target==="teacher").map(item=><div key={item.id} className="border-t border-neutral-100 pt-2 text-xs">
                <p className="font-bold">{item.subject}</p><p className="mt-1 whitespace-pre-wrap">{item.body}</p>
              </div>)}
            </div>
          </details> : null}
        </section>
        <div className="mt-4 space-y-2">
          {services.map(service => <div className="rounded-xl border border-neutral-200 p-3" key={service.id}>
            <p className="text-sm font-bold">{school} ＞ {service.name}（月{service.monthlyVisits}回・{yen(service.monthlyFee)}）</p>
            {service.slots.map(slot=><p key={slot.id} className="mt-1 pl-3 text-xs text-neutral-600">{slot.name} ／ {slot.weekday} {slot.startsAt} ／月謝{yen(feeForSlot(service,slot))}{slot.feeOverride === null ? "（継承）" : "（個別）"} ／定員{slot.capacity}名・利用{slot.occupied}名</p>)}
            {!service.slots.length ? <p className="mt-1 text-xs text-amber-800">時間枠未設定</p> : null}
          </div>)}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-neutral-100 p-4"><p className="text-xs">選択中の時間枠の残席</p><p className="mt-2 text-2xl font-bold">{available}</p></div>
          <div className="rounded-xl bg-neutral-100 p-4"><p className="text-xs">翌月の継続確定</p><p className="mt-2 text-lg font-bold">前月{closeDay+1}日</p></div>
          <div className="rounded-xl bg-neutral-100 p-4"><p className="text-xs">生徒が選択した支払方法</p><p className="mt-2 text-lg font-bold">{methodLabel}</p><p className="mt-1 text-xs text-neutral-500">受付可能：{paymentOptions.map(item => item.label).join("・")}</p></div>
        </div>
        <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50/30 p-4">
          <h3 className="font-bold">退会届の受付・確認（デモ）</h3>
          {!withdrawal ? <p className="mt-2 text-sm text-neutral-600">現在、確認待ちの退会届はありません。</p> :
            <div className="mt-3 space-y-2 text-sm">
              <p>対象：{students.find(student=>student.id===withdrawal.studentId)?.name ?? "生徒"}</p>
              <p>受付日：{withdrawal.receivedAt}／最終受講予定日：{withdrawal.finalDay}</p>
              <p>届出者：{withdrawal.actor==="guardian"?"保護者":"生徒本人"}</p>
              <p>保護者確認：{withdrawal.guardianConfirmed?"確認済み":"未確認"}</p>
              {withdrawal.reason && <p>連絡事項：{withdrawal.reason}</p>}
              <p className="font-semibold">状態：{withdrawal.status==="pending"?"受付済み・確認待ち":withdrawal.status==="approved"?"先生が確定済み":"見送り・要相談"}</p>
              {withdrawal.status==="pending" && <div className="flex flex-wrap gap-2">
                <button className={primary+" disabled:opacity-40"} disabled={!withdrawal.guardianConfirmed} onClick={()=>decideWithdrawal(true)}>最終受講日を確認して退会を確定</button>
                <button className={secondary} onClick={()=>decideWithdrawal(false)}>確認・相談が必要</button>
              </div>}
              {withdrawal.status==="pending" && !withdrawal.guardianConfirmed && <p className="text-xs text-amber-900">保護者による確認待ちのため、退会を確定できません。</p>}
            </div>}
        </section>
        <section className="mt-5 rounded-xl border border-neutral-200 p-4">
          <h3 className="font-bold">生徒ごとの受講終了予定（デモ）</h3>
          <p className="mt-1 text-xs text-neutral-600">高校卒業・転居・期間契約など、理由を限定せず個別に期限を設定します。空欄なら自動終了なし。</p>
          <div className="mt-4 space-y-3">{students.map(student => {
            const assignment = services.flatMap(service => service.slots.map(slot => ({ service, slot }))).find(item => item.slot.id === student.slotId);
            return <div key={student.id} className="grid gap-2 rounded-lg bg-neutral-50 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div><p className="text-sm font-semibold">{student.name}</p><p className="text-xs text-neutral-600">{assignment ? assignment.service.name + " ＞ " + assignment.slot.name : "所属なし"}</p></div>
              <label className="text-xs">最終受講日
                <input type="date" className="mt-1 block rounded-lg border border-neutral-300 bg-white p-2 text-sm" value={student.endsOn ?? ""}
                  onChange={e=>setStudents(current=>current.map(item=>item.id===student.id ? {...item,endsOn:e.target.value||null}:item))}/>
              </label>
            </div>;
          })}</div>
          <p className="mt-3 text-xs text-neutral-600">設定した終了日の翌月以降は定期請求の対象外とします。実装時は対象月、退会承認、繰越・既確定請求などの整合性を確認します。</p>
        </section>
        <div className="mt-5 rounded-xl border border-neutral-200 p-4">
          <h3 className="font-bold">事業全体の月謝明細（設定値からの試算）</h3>
          <p className="mt-1 text-xs text-neutral-600">各生徒の受講終了日を考慮した対象月の定期月謝見込みです。実際の請求・入金台帳ではありません。</p>
          <label className="mt-3 block text-sm">試算する月
            <input type="month" className="ml-2 rounded-lg border p-2 text-sm" value={billingMonth} onChange={e=>setBillingMonth(e.target.value)}/>
          </label>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b text-xs text-neutral-600"><th className="py-2 pr-3">サービス・時間枠</th><th className="py-2 pr-3 text-right">月謝</th><th className="py-2 pr-3 text-right">人数</th><th className="py-2 text-right">金額</th></tr></thead>
              <tbody>
                {billingRows.map(row => <tr key={row.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-3">{row.serviceName} ＞ {row.slotName}<span className="ml-1 text-xs text-neutral-500">{row.inherited ? "継承" : "個別"}</span></td>
                  <td className="py-2 pr-3 text-right whitespace-nowrap">{yen(row.unitPrice)}</td>
                  <td className="py-2 pr-3 text-right">{row.billableCount}名</td>
                  <td className="py-2 text-right whitespace-nowrap">{yen(row.amount)}</td>
                </tr>)}
              </tbody>
              <tfoot><tr className="font-bold"><td className="pt-3" colSpan={3}>事業全体の月謝合計（試算）</td><td className="pt-3 text-right whitespace-nowrap">{yen(billingTotal)}</td></tr></tfoot>
            </table>
          </div>
          <p className="mt-3 text-xs text-neutral-500">実装時は生徒・請求月・入会金・追加料金ごとに明細を確定保存し、支払済み・未納を同じ管理画面で表示します。後の料金変更で過去の請求金額は書き換えません。</p>
        </div>
        <div className="mt-5 rounded-xl border border-neutral-200 p-4">
          <h3 className="font-bold">月謝の管理例</h3>
          <p className="mt-1 text-xs text-neutral-600">{school} ＞ {chosenService?.name} ＞ {className}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm">{requestName}／翌月分 {yen(monthlyFee)}</p><p className="mt-1 text-xs text-neutral-600">支払方法：{methodLabel}／{paymentRecorded?"入金済み":"未入金"}・支払期限：前月末日</p></div>
            {payMethod !== "card" ? <button className={secondary} onClick={()=>setPaymentRecorded(v=>!v)}>{paymentRecorded?"入金記録を取り消す":"入金済みにする"}</button>
              : <span className="text-xs text-neutral-600">カードの決済結果を自動反映（予定）</span>}
          </div>
        </div>
        <p className="mt-4 text-xs text-neutral-500">これらの変更は画面内のダミー状態だけに反映されます。既存名簿や本物の請求には影響しません。</p>
      </section> : null}
    </div>
  </main>;
}
