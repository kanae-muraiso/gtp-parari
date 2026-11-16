"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import ClassRecruitmentPanel from "./ClassRecruitmentPanel";
import ClassAdmissionBlueprint from "./ClassAdmissionBlueprint";
import { useSearchParams } from "next/navigation";
import ClassBusinessPicker from "./ClassBusinessPicker";
import ClassProductPanel from "./ClassProductPanel";
import ClassCalendarPanel from "./ClassCalendarPanel";
import ClassEventsPanel from "./ClassEventsPanel";
import ClassAdmissionsPanel from "./ClassAdmissionsPanel";
import { classRequest, ClassRequestError } from "@/lib/classRequests";
import { classSchedule, type ClassManagement, type SchoolClass, type ClassRosterMember } from "@/lib/classes";
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
  const business = useSearchParams().get("business");
  return business ? <BusinessClassManager key={business} /> : <ClassBusinessPicker />;
}

function BusinessClassManager() {
  const [deliveryDraft, setDeliveryDraft] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [schoolAdmission, setSchoolAdmission] = useState(false);
  const [section, setSection] = useState<"classes" | "calendar" | "event" | "workshop">("classes");
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [showBlueprint, setShowBlueprint] = useState(false);
  const [newSlot, setNewSlot] = useState<{ id: string; productId: string } | null>(null);
  const creating = newSlot !== null;
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<"admissions" | "settings" | "roster" | "product" | "preview" | "schedule">("product");
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
  }, [userId, reload]);

  async function save(body: object, success: string) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const result = await classRequest<ClassManagement>("", body);
      setData(result);
      if ("action" in body && body.action === "create") {
        setNewSlot(null);
        setDeliveryDraft(null);
      }
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
      {error && !needsLogin && <button type="button" className={button} onClick={() => setReload(value => value + 1)}>再読み込み</button>}
      {needsLogin && <Link className="underline" href={`/login?returnTo=${encodeURIComponent(managePath)}`}>ログイン</Link>}
    </div>;
  }
  const school = data.school;
  if (!school) return <section className={panel}><p>事業を選択してください。</p><Link href="/my/manage?tab=class" className="underline">事業一覧へ</Link></section>;
  const item = school.classes.find(entry => entry.id === selectedId);
  const slotProduct = data.products?.find(product => product.id === newSlot?.productId);
  const reloadProducts = () => void classRequest<ClassManagement>().then(setData).catch(() => setError("一覧を更新できませんでした。"));

  const backToList = () => {
    setSelectedId(null);
    setSchoolAdmission(false);
    setNewSlot(null);
    setDeliveryDraft(null);
    setError("");
    setMessage("");
  };
  const delivery = deliveryDraft ?? item?.delivery ?? "onsite";
  const currentAdmissionMissing = data.applicationId && !data.applications.some(application => application.id === data.applicationId);

  return <div className="grid gap-5">
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Link className="underline" href="/my/manage?tab=class">事業一覧へ</Link>
      <strong>{school?.name}</strong>
    </div>
    {!item && !creating && !schoolAdmission && <details className="w-fit max-w-full rounded-lg border border-neutral-200 bg-white open:w-full">
      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">事業設定</summary>
      <div className="grid gap-3 border-t border-neutral-200 px-3 py-3">
        <p className="text-sm text-neutral-600">この事業のクラスで共通して使う呼び方を設定します。</p>
        <ClassAdmissionsPanel key={school.id + ":labels"} mode="labels" />
      </div>
    </details>}
    {!item && !creating && !schoolAdmission && <nav className="flex flex-wrap gap-2" aria-label="事業の運営">
      {([["classes", "クラス一覧"], ["calendar", "開催予定"], ["event", "イベント"], ["workshop", "講習会"]] as const).map(([key, label]) =>
        <button key={key} type="button" aria-pressed={section === key} className={section === key ? button : "rounded-lg border bg-white px-4 py-2 text-sm"}
          onClick={() => setSection(key)}>{label}</button>)}
    </nav>}
    {!item && !creating && !schoolAdmission && (section === "event" || section === "workshop") &&
      <ClassEventsPanel key={section} kind={section} classes={school.classes} roster={data.roster} />}
    {!item && !creating && !schoolAdmission && section === "calendar" && <ClassCalendarPanel classes={school.classes} />}
    {section === "classes" && !item && !creating && !schoolAdmission && <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">クラス一覧</h2>
        {school && <button type="button" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm" onClick={() => {
          setSchoolAdmission(true); setView("settings");
        }}>教室共通の入会設定</button>}
        <button type="button" className={button} aria-expanded={editingProduct === ""}
          onClick={() => setEditingProduct(current => current === "" ? null : "")}>
          {editingProduct === "" ? "商品作成を閉じる" : "商品を作成"}
        </button>
      </div>
      <p className="text-sm text-neutral-600">「中学英語」のように教える内容を商品として作り、商品ごとに曜日・時間・会場の組み合わせを開催枠として追加します。</p>
      {editingProduct === "" && <ClassProductPanel classes={school.classes} allowProductSelection={false} onSaved={() => { setEditingProduct(null); reloadProducts(); }} />}
      {[...(data.products ?? []), { id: "", name: "商品未設定の開催枠" }].map(product => {
        const entries = school?.classes.filter(item => (item.product_id ?? "") === product.id) ?? [];
        if (!entries.length && !product.id) return null;
        return <section key={product.id || "unassigned"} className="grid gap-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{product.name}</h3>
            {product.id && <button type="button" aria-expanded={editingProduct === product.id}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              onClick={() => setEditingProduct(current => current === product.id ? null : product.id)}>
              {editingProduct === product.id ? "商品設定を閉じる" : "商品設定を編集"}
            </button>}
          </div>
          {product.id && editingProduct === product.id && <ClassProductPanel key={product.id}
            classes={school.classes} initialProduct={product.id} allowProductSelection={false} onSaved={reloadProducts} />}
          {entries.map(entry => <button key={entry.id} type="button"
            onClick={() => { setSelectedId(entry.id); setView("roster"); }}
            className="grid gap-1 rounded-lg border p-3 text-left hover:border-neutral-500">
            <span>{entry.name}</span><span className="text-sm text-neutral-600">{classSchedule(entry)}{entry.location ? " · " + entry.location : ""}{entry.fee_override_yen != null ? " · " + entry.fee_override_yen.toLocaleString("ja-JP") + "円" : ""}</span>
          </button>)}
          {product.id && <button type="button" className={button} aria-label={product.name + "に開催枠を追加"}
            onClick={() => { setNewSlot({ id: crypto.randomUUID(), productId: product.id }); setEditingProduct(null); setError(""); setMessage(""); }}>
            開催枠を追加
          </button>}
        </section>;
      })}
      {!data.products?.length && <p className="text-sm text-neutral-600">開催枠を追加するには、商品を作成してください。</p>}
    </section>}
    {(item || creating || schoolAdmission) && <header className="grid gap-2">
      <button type="button" className="w-fit text-sm underline" disabled={busy} onClick={backToList}>クラス一覧に戻る</button>
      <h2 className="text-xl font-bold">{item?.name ?? (schoolAdmission ? school.name : "開催枠を追加")}</h2>
    </header>}
    {(item || schoolAdmission) && <nav aria-label="クラス運営" className="flex flex-wrap gap-2">
      {([["product", "商品設定"], ["settings", "入会設定"], ["preview", "申込者として試す"], ["admissions", "申込者・入会対応"], ["roster", "名簿・クラス"], ["schedule", "開催予定・休講"]] as const).filter(([key]) => !schoolAdmission || key === "settings" || key === "preview" || key === "admissions").map(([key, title]) =>
        <button key={key} type="button" aria-pressed={view === key} onClick={() => { setView(key); setMessage(""); setError(""); }}
          className={view === key ? button : "rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm"}>{title}</button>)}
    </nav>}
    {item && view === "schedule" && <ClassCalendarPanel key={item.id} classes={school.classes} selectedClass={item} />}
    {(creating || (item && view === "roster")) && <form key={school?.id ?? "new"} className={panel} onSubmit={event => {
      const values = formValues(event);
      const slot = newSlot;
      void save({ ...values, classId: slot?.id ?? item?.id,
        ...(slot ? { productId: slot.productId, schoolName: school.name } : {}), action: slot ? "create" : "schedule" },
        slot ? "開催枠を追加しました。" : "開催枠の設定を保存しました。");
    }}>
      {creating ? <p className="text-sm">対象の商品 <strong>{slotProduct?.name}</strong></p> : <>
        <h3 className="font-bold">開催枠の設定</h3>
        <label className={label}>教室名<input className={field} name="schoolName" required maxLength={120} defaultValue={school.name} /></label>
      </>}
      <label className={label}>開催枠の名前<input className={field} name="name" required maxLength={120} defaultValue={item?.name} /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>頻度<select className={field} name="cadence" defaultValue={item?.cadence ?? "weekly"}>
          <option value="weekly">毎週</option><option value="monthly">毎月</option>
        </select></label>
        <label className={label}>初回日<input className={field} type="date" name="date" required defaultValue={item?.starts_on} /></label>
        <label className={label}>開始時刻（日本時間）<input className={field} type="time" name="time" required defaultValue={item?.starts_at.slice(0, 5)} /></label>
      </div>
      <label className={label}>開催枠の料金（円・空欄なら商品の基本料金）
        <input className={field} name="feeOverride" type="number" min={0} max={1000000} defaultValue={item?.fee_override_yen ?? ""} />
      </label>
      <p className="text-sm text-neutral-600">契約時の料金より高い枠は、予約ごとに差額が発生します。</p>
      <label className={label}>所要時間（分）<input className={field} name="duration" type="number" min={5} max={480} required defaultValue={item?.duration_minutes ?? 60} /></label>
      <label className={label}>開催方法<select className={field} name="delivery" value={delivery} onChange={event => setDeliveryDraft(event.target.value)}>
        <option value="onsite">対面</option><option value="online">オンライン</option><option value="hybrid">対面とオンライン</option>
      </select></label>
      {delivery !== "online" && <label className={label}>会場<input className={field} name="location" maxLength={200} required={delivery === "hybrid"} defaultValue={item?.location ?? ""} /></label>}
      {delivery !== "onsite" && <label className={label}>授業の参加リンク<input className={field} name="meetingUrl" type="url" maxLength={2000} required defaultValue={item?.meeting_url ?? ""} /></label>}
      <div className="flex flex-wrap items-center gap-4">
        <button className={button} disabled={busy || (creating && !slotProduct)}>{creating ? "この商品に追加" : "保存"}</button>
        {school && <Link className="text-sm underline" href={`/my/classes/${school.id}`}>受講者ページを開く</Link>}
      </div>
    </form>}
    {item && view === "roster" && !item.product_id && Boolean(data.otherBusinesses?.length) &&
      <form className={panel} onSubmit={async event => {
        const values = formValues(event);
        if (await save({ action: "moveSlot", destination: values.destination, classId: item.id }, "開催枠を移動しました。")) setSelectedId(null);
      }}>
        <label className={label}>未使用の開催枠を別事業へ移す
          <select className={field} name="destination" required defaultValue="">
            <option value="">移動先を選択</option>{data.otherBusinesses?.map(business => <option key={business.id} value={business.id}>{business.name}</option>)}
          </select>
        </label>
        <button className={button} disabled={busy}>開催枠を移す</button>
      </form>}
    {school && (item || schoolAdmission) && <>
      {(view === "settings" || view === "preview") && <p className="text-sm text-neutral-600">「{school.name}」の入会手続きを設定します。募集ページごとに対象クラスを選べます。</p>}
      {view === "product" && <ClassProductPanel key={item?.id ?? school.id} classes={school.classes} initialProduct={item?.product_id}
        initialClass={item?.id} onSaved={() => void classRequest<ClassManagement>().then(setData).catch(() => setError("一覧を更新できませんでした。"))} />}
      {view === "settings" && <button type="button" className="w-fit rounded-lg border bg-white px-3 py-2 text-sm"
        aria-expanded={showBlueprint} onClick={() => setShowBlueprint(value => !value)}>
        {showBlueprint ? "入会の設計図を閉じる" : "入会の設計図を作る（試作）"}
      </button>}
      {view === "settings" && showBlueprint && <ClassAdmissionBlueprint key={school.id} schoolId={school.id} schoolName={school.name} />}
      {(view === "settings" || view === "preview") && <ClassRecruitmentPanel key={view} view={view} classes={school.classes} onOpenSettings={() => setView("settings")} />}
      {(view === "admissions" || view === "settings") && <ClassAdmissionsPanel key={school.id + view} mode={view} onRosterChanged={() => {
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
          if (await save({ ...values, action: "add", memberId: requestId, classId: item?.id }, "名簿に登録しました。")) {
            setMemberId(null);
            form.reset();
          }
        }}>
          <label className={label}>受講者名<input className={field} name="name" required maxLength={120} /></label>
          <label className={label}>PARARIユーザー名（任意）<input className={field} name="username" maxLength={120} /></label>
          <button className={button} disabled={busy}>追加</button>
        </form>
        {Boolean(data.surcharges?.length) && <section className="grid gap-2 border-t pt-3">
          <h4 className="font-semibold">差額の入金待ち</h4>
          {data.surcharges?.map(charge => <div className="flex flex-wrap items-center gap-2 text-sm"
            key={charge.enrollment_id + charge.class_id + charge.visit_on}>
            <span>{data.roster.find(member => member.id === charge.enrollment_id)?.name} · {charge.visit_on} · {school.classes.find(slot => slot.id === charge.class_id)?.name} · {charge.surcharge_yen.toLocaleString("ja-JP")}円</span>
            <button type="button" className={button} disabled={busy} onClick={() => void save({
              action: "confirmSurcharge", memberId: charge.enrollment_id, classId: charge.class_id, day: charge.visit_on,
            }, "差額の入金を記録しました。")}>入金を確認</button>
          </div>)}
        </section>}
        {Boolean(data.receipts?.length) && <details className="text-sm"><summary className="cursor-pointer">最近の差額入金記録</summary>
          {data.receipts?.map(receipt => <p className="mt-1" key={receipt.id}>
            {data.roster.find(member => member.id === receipt.enrollment_id)?.name} · {receipt.visit_on} · {receipt.amount_yen.toLocaleString("ja-JP")}円
          </p>)}
        </details>}
        {data.roster.length === 0 && <p className="text-sm text-neutral-600">名簿に登録された受講者はいません。</p>}
        <ul className="divide-y divide-neutral-200">
          {data.roster.map(member => <li key={member.id} className="py-3"><RosterRow member={member} classes={school.classes} busy={busy} save={save} /></li>)}
        </ul>
      </section>}
    </>}
    <div aria-live="polite">
      {error && <p className="text-sm text-red-800" role="alert">{error}</p>}
      {message && <p className="text-sm text-emerald-900">{message}</p>}
    </div>
  </div>;
}

function RosterRow({ member, classes, busy, save }: {
  member: ClassRosterMember;
  classes: SchoolClass[];
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
      <label className={label}>契約時の料金（円）<input className={field} name="contractFee" type="number" min={0} max={1000000}
        defaultValue={member.contract_fee_yen ?? ""} placeholder="商品の基本料金" /></label>
      <button className={button} disabled={busy}>更新</button>
    </form>
    <details className="text-sm">
      <summary className="cursor-pointer">参加方法・対象クラス</summary>
      <form className="mt-2 grid gap-2" onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void save({ action: "participation", memberId: member.id, mode: data.get("mode"), classIds: data.getAll("classId") }, "参加方法を保存しました。");
      }}>
        <label>参加方法<select className={field} name="mode" defaultValue={member.class_participation ?? "fixed"}>
          <option value="fixed">固定クラス</option><option value="multiple">複数クラスに所属</option><option value="flexible">対象クラスを横断</option>
        </select></label>
        <fieldset disabled={busy} className="grid gap-1"><legend>参加できるクラス</legend>
          {classes.map(item => <label key={item.id}><input name="classId" type="checkbox" value={item.id}
            defaultChecked={member.assignments?.some(a => a.class_id === item.id)} /> {item.name}</label>)}
        </fieldset>
        <button className={button} disabled={busy}>参加方法を保存</button>
      </form>
    </details>
    {member.status === "active" && member.class_participation !== "flexible" && classes.some(item => item.product_id &&
      member.assignments?.some(row => row.class_id === item.id)) && <details className="text-sm">
      <summary className="cursor-pointer">欠席分の振替を付与</summary>
      <form className="mt-2 grid gap-2" onSubmit={event => {
        const values = formValues(event);
        void save({ ...values, action: "grantMakeup", memberId: member.id }, "振替を1回分付与しました。");
      }}>
        <label>欠席した開催枠<select className={field} name="classId" required>
          {classes.filter(item => item.product_id && member.assignments?.some(row => row.class_id === item.id)).map(item =>
            <option value={item.id} key={item.id}>{item.name}</option>)}
        </select></label>
        <label>欠席日<input className={field} type="date" name="day" required /></label>
        <button className={button} disabled={busy}>振替を付与</button>
      </form>
    </details>}
    {!member.user_id && <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
      const values = formValues(event);
      void save({ ...values, action: "link", memberId: member.id }, "アカウントを連携しました。");
    }}>
      <label className={label}>連携するPARARIユーザー名<input className={field} name="username" maxLength={120} required /></label>
      <button className={button} disabled={busy}>連携</button>
    </form>}
  </div>;
}
