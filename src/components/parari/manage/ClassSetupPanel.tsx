"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { classRequest } from "@/lib/classRequests";
import { classSetupSteps, classFrontPublishIssues, classRegistrationIssues } from "@/lib/classSetup";
import { selectClassBusinessFrontLinks } from "@/lib/classBusinessFront";
import { classSchedule, type ClassManagement } from "@/lib/classes";
import type { NamedClassProduct } from "@/lib/classProduct";
import type { AdmissionsData } from "@/lib/classAdmissions";
import ClassBusinessFrontView from "@/components/parari/classes/ClassBusinessFrontView";
import ClassAdmissionsPanel from "./ClassAdmissionsPanel";
import ClassAdmissionBlueprint from "./ClassAdmissionBlueprint";
import ClassProductPanel from "./ClassProductPanel";
import ClassSlotSettingsPanel from "./ClassSlotSettingsPanel";
import ClassCalendarPanel from "./ClassCalendarPanel";
import ClassRecruitmentPanel, { type ClassRecruitmentData } from "./ClassRecruitmentPanel";
import ClassBusinessFrontPanel, { type FrontSettings } from "./ClassBusinessFrontPanel";

type Snapshot = { management: ClassManagement; products: NamedClassProduct[]; recruitment: ClassRecruitmentData;
  front: FrontSettings; admissions: AdmissionsData };
const panel = "grid gap-4 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5";
const button = "w-fit rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-50";
const primary = "w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const blockLabels: Record<string, string> = {
  name: "教室・事業名", introduction: "紹介文", labels: "呼び方", product: "クラスの内容・料金",
  slot: "開催日時・会場", recruitment: "入会方法", briefing: "説明会後の申込書・メール",
  offer: "クラスごとの入会方法", terms: "規約・テスト・代理申込者", front: "公開ページ",
};
const field = "block w-full rounded-lg border border-neutral-300 px-3 py-2";

export default function ClassSetupPanel({ schoolId, onOperate }: { schoolId: string; onOperate: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const pendingSaves = useRef(new Map<string, (success: boolean) => void>());
  const editVersions = useRef(new Map<string, number>());
  const savingVersions = useRef(new Map<string, number>());
  const [savingChanges, setSavingChanges] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState<string[]>([]);
  const [destination, setDestination] = useState<number | "operate" | null>(null);
  const [generation, setGeneration] = useState(0);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ id: string; productId: string } | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      classRequest<ClassManagement>("", undefined, request.signal),
      classRequest<{ products: NamedClassProduct[] }>("?product=1", undefined, request.signal),
      classRequest<ClassRecruitmentData>("/recruitment", undefined, request.signal),
      classRequest<FrontSettings>("/front", undefined, request.signal),
      classRequest<AdmissionsData>("/admissions?settings=1", undefined, request.signal),
    ]).then(([management, products, recruitment, front, admissions]) => {
      if (!request.signal.aborted && management.school?.id === schoolId) {
        setSnapshot({ management, products: products.products, recruitment, front, admissions });
      }
    }).catch(cause => {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "開設準備を読み込めませんでした。");
    }).finally(() => { if (!request.signal.aborted) setLoading(false); });
    return () => request.abort();
  }, [schoolId, refresh]);

  const markDirty = useCallback((block: string) => {
    editVersions.current.set(block, (editVersions.current.get(block) ?? 0) + 1);
    setDirty(current => current.includes(block) ? current : [...current, block]);
    if (block !== "front") setReviewed(false);
  }, []);

  useEffect(() => {
    if (!dirty.length) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty.length]);

  useEffect(() => {
    if (!dirty.length && !savingChanges) setDestination(null);
  }, [dirty.length, savingChanges]);

  function saved(block?: string, invalidateReview = block !== "front") {
    if (block) {
      const editedDuringSave = savingVersions.current.has(block) && savingVersions.current.get(block) !== editVersions.current.get(block);
      if (!editedDuringSave) setDirty(current => current.filter(value => value !== block));
      pendingSaves.current.get(block)?.(!editedDuringSave);
      pendingSaves.current.delete(block);
      savingVersions.current.delete(block);
    }
    if (invalidateReview) setReviewed(false);
    setRefresh(value => value + 1);
  }

  function moveTo(next: number | "operate") {
    setDestination(null);
    setDirty([]);
    setGeneration(value => value + 1);
    setEditingProduct(null);
    setSlot(null);
    if (next === "operate") onOperate();
    else { setStep(next); setRefresh(value => value + 1); }
  }

  function navigate(next: number | "operate", discard = false) {
    if (busy || loading || savingChanges) return;
    if (dirty.length && !discard) { setDestination(next); return; }
    moveTo(next);
  }

  function saveFailed(block: string) {
    pendingSaves.current.get(block)?.(false);
    pendingSaves.current.delete(block);
    savingVersions.current.delete(block);
  }

  async function saveAndContinue() {
    if (destination === null || savingChanges || busy || loading) return;
    const next = destination;
    const versions = new Map<string, number>();
    setSavingChanges(true);
    setError("");
    try {
      for (const block of dirty) {
        if (!container.current) return;
        versions.set(block, editVersions.current.get(block) ?? 0);
        const section = container.current?.querySelector<HTMLElement>(`[data-setup-block="${block}"]`);
        const form = section?.matches("form") ? section as HTMLFormElement : section?.querySelector("form");
        const saveButton = section?.querySelector<HTMLButtonElement>("[data-setup-save]");
        const details = section?.closest("details");
        if (details) details.open = true;
        if (form && !form.reportValidity()) return;
        if (!form && (!saveButton || saveButton.disabled)) {
          setError(`「${blockLabels[block]}」の保存画面を確認してください。`);
          return;
        }
        const success = await new Promise<boolean>(resolve => {
          pendingSaves.current.set(block, resolve);
          savingVersions.current.set(block, editVersions.current.get(block) ?? 0);
          if (form) form.requestSubmit();
          else saveButton!.click();
        });
        if (!success) {
          setError(`「${blockLabels[block]}」を保存できませんでした。入力内容を確認して、もう一度保存してください。`);
          return;
        }
      }
      if ([...versions].some(([block, version]) => editVersions.current.get(block) !== version)) {
        setError("保存中に入力が変更されました。最新の入力内容をもう一度保存してください。");
        return;
      }
      if (container.current) moveTo(next);
    } catch {
      setError("保存を完了できませんでした。入力内容を確認して、もう一度保存してください。");
    } finally { setSavingChanges(false); }
  }

  async function store(block: string, path: string, body: object) {
    setBusy(true);
    setError("");
    try {
      await classRequest(path, body);
      saved(block);
      return true;
    } catch (cause) {
      saveFailed(block);
      setError(cause instanceof Error ? cause.message : "保存できませんでした。");
      return false;
    } finally { setBusy(false); }
  }

  if (!snapshot) return <section className={panel}>
    <p role={error ? "alert" : "status"}>{error || "開設準備を読み込んでいます…"}</p>
    {error && <button type="button" className={button} onClick={() => setRefresh(value => value + 1)}>再読み込み</button>}
  </section>;

  const { management, products, recruitment, front, admissions } = snapshot;
  const school = management.school!;
  const draft = front.front.draft;
  const content = draft.entries.length ? draft : { ...draft, entries: front.links.map(link => link.key) };
  const selected = selectClassBusinessFrontLinks(content.entries, front.links);
  const missingDates = products.filter(product => !school.classes.some(item => item.product_id === product.id));
  const missingContent = products.filter(product => !product.design.description?.trim());
  const missingUpcoming = products.filter(product => !front.links.some(link => link.course?.id === product.id && link.course.slots.some(slot => slot.upcoming?.length)));
  const intake = recruitment.recruitment;
  const usesBriefing = intake?.route === "briefing" || Boolean(recruitment.offers?.some(offer => offer.route_override === "briefing"));
  const registrationIssues = classRegistrationIssues(intake && usesBriefing ? { ...intake, route: "briefing" } : intake, recruitment.sharedDisclosure === true, recruitment.available.length, Boolean(admissions.briefingDesign));
  const registrationReady = registrationIssues.length === 0;
  const statuses = [
    school.name.trim() && draft.introduction.trim() ? "設定済み" : "紹介文を保存してください",
    products.length && !missingContent.length ? "設定済み" : "内容と料金を保存してください",
    products.length && !missingDates.length && !missingUpcoming.length ? "設定済み" : "各クラスの開催日を登録してください",
    registrationReady ? "設定済み" : registrationIssues[0],
    reviewed ? "確認済み" : "申込者の画面を確認してください",
    front.front.published && !classFrontPublishIssues(front.front.published, front.links).length ? "公開中" : "公開状態を確認してください",
  ];
  const ready = statuses.map(status => ["設定済み", "確認済み", "公開中"].includes(status));
  const publicationBlockers = statuses.slice(0, 4).flatMap((status, index) => ready[index] ? [] : [classSetupSteps[index].title + "で" + status]);
  if (!reviewed) publicationBlockers.push("「お客様として確認」で申込画面と対応内容を確認してください。");
  const activeSlot = school.classes.find(item => item.id === slot?.id);
  const activeProduct = products.find(item => item.id === slot?.productId);
  const childSlots = activeSlot ? school.classes.filter(item => item.product_id === activeSlot.product_id && item.schedule_rules?.parentSlotId === activeSlot.id) : [];

  return <div ref={container} className="grid gap-5">
    <header className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">開設準備</h2>
        <button type="button" className={button} disabled={busy || loading || savingChanges} onClick={() => navigate("operate")}>日々の運営へ</button>
      </div>
      <p className="text-sm text-neutral-600">順番に設定すると、紹介ページから入会受付までの準備を確認できます。設定済みの内容は各段階で編集できます。</p>
    </header>
    <nav aria-label="開設準備の手順">
      <ol className="grid gap-2 sm:grid-cols-3">
        {classSetupSteps.map((entry, index) => <li key={entry.title}>
          <button type="button" aria-current={step === index ? "step" : undefined} disabled={loading || busy || savingChanges}
            onClick={() => navigate(index)} className={`grid h-full w-full gap-1 rounded-lg border px-3 py-3 text-left disabled:opacity-50 ${step === index ? "border-emerald-700 bg-emerald-50" : "border-neutral-200 bg-white"}`}>
            <span className="text-sm font-semibold">{index + 1}. {entry.title}</span>
            <span className="text-xs text-neutral-600">{statuses[index]}</span>
          </button>
        </li>)}
      </ol>
    </nav>
    {destination !== null && <div role="alert" className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
      <p>{savingChanges ? "変更を保存しています…" : dirty.map(block => "「" + blockLabels[block] + "」").join("・") + "の変更がまだ保存されていません。"}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={primary} disabled={savingChanges || busy || loading} onClick={() => void saveAndContinue()}>{savingChanges ? "保存しています…" : "保存して次へ"}</button>
        <button type="button" className="underline" disabled={savingChanges} onClick={() => setDestination(null)}>この画面で確認する</button>
        <button type="button" className="underline" disabled={savingChanges} onClick={() => navigate(destination, true)}>保存せずに進む</button>
      </div>
    </div>}
    {error && <div role="alert" className="flex flex-wrap gap-2 text-sm text-red-800">{error}
      <button type="button" className="underline" onClick={() => setRefresh(value => value + 1)}>保存状態を再確認</button>
    </div>}
    <header className="grid gap-1">
      <h3 className="text-xl font-bold">{step + 1}. {classSetupSteps[step].title}</h3>
      <p className="text-sm text-neutral-600">{classSetupSteps[step].description}</p>
    </header>
    <div key={step + ":" + generation} className="grid gap-4">
      {step === 0 && <>
        <form data-setup-block="name" className={panel} onChange={() => markDirty("name")} onSubmit={event => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          void store("name", "", { action: "renameBusiness", name: values.get("name"), expectedName: school.name });
        }}>
          <label className="grid gap-1 text-sm">教室・事業名<input name="name" className={field} defaultValue={school.name} maxLength={120} required /></label>
          <button className={primary} disabled={busy}>名前を保存</button>
        </form>
        <form data-setup-block="introduction" className={panel} onChange={() => markDirty("introduction")} onSubmit={event => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          void store("introduction", "/front", { action: "saveFront", revision: front.front.revision,
            content: { ...draft, introduction: String(values.get("introduction") ?? "") } });
        }}>
          <label className="grid gap-1 text-sm">紹介文<textarea name="introduction" className={field} defaultValue={draft.introduction} rows={4} maxLength={3000} required /></label>
          <p className="text-sm text-neutral-600">どんな教室か、どんな方に来てほしいかを書きます。この文章が公開ページに載ります。</p>
          <button className={primary} disabled={busy}>紹介文を保存</button>
        </form>
        <div data-setup-block="labels" onChangeCapture={() => markDirty("labels")}><ClassAdmissionsPanel mode="labels" onSaveError={() => saveFailed("labels")} onSaved={() => saved("labels")} /></div>
      </>}
      {step === 1 && <>
        <button type="button" className={primary} disabled={editingProduct !== null} onClick={() => setEditingProduct("")}>クラスを作る</button>
        {products.map(product => <section className={panel} key={product.id}>
          <h4 className="font-semibold">{product.name}</h4>
          <p className="whitespace-pre-wrap text-sm">{product.design.description || "内容を入力してください。"}</p>
          <p className="text-sm">{product.design.walkInFee != null ? "予約不要の当日参加" : product.design.booking === "flexible" ? "好きな回を予約する" : "決まった枠に通う"}</p>
          <button type="button" className={button} disabled={editingProduct !== null} onClick={() => setEditingProduct(product.id)}>内容・料金を編集</button>
        </section>)}
        {editingProduct !== null && <div data-setup-block="product" onChangeCapture={() => markDirty("product")}>
          <ClassProductPanel key={editingProduct} classes={school.classes} initialProduct={editingProduct || undefined} allowProductSelection={false} onDraftChange={() => markDirty("product")}
            onSaveError={() => saveFailed("product")} onSaved={() => { setEditingProduct(null); saved("product"); }} />
        </div>}
      </>}
      {step === 2 && <>
        {!products.length && <button type="button" className={button} onClick={() => navigate(1)}>先にクラスの内容・料金を決める</button>}
        {!slot && products.map(product => <section className={panel} key={product.id}>
          <h4 className="font-semibold">{product.name}</h4>
          {school.classes.filter(item => item.product_id === product.id && !item.schedule_rules?.parentSlotId).map(item => <button key={item.id} type="button" className={button}
            onClick={() => setSlot({ id: item.id, productId: product.id })}>{item.name} · {classSchedule(item)}</button>)}
          <button type="button" className={primary} onClick={() => setSlot({ id: crypto.randomUUID(), productId: product.id })}>曜日・時間・会場を追加</button>
        </section>)}
        {slot && activeProduct && <section className={panel}>
          <h4 className="font-semibold">{activeProduct.name}の開催日</h4>
          <div data-setup-block="slot" onChangeCapture={() => markDirty("slot")}>
            <ClassSlotSettingsPanel key={slot.id} item={activeSlot} additionalSlots={childSlots} startId={slot.id} productId={slot.productId}
              slotDefaults={activeProduct.design.slotDefaults} basicFee={activeProduct.design.walkInFee ?? activeProduct.design.monthlyFee}
              walkIn={activeProduct.design.walkInFee != null} busy={busy} onDraftChange={() => markDirty("slot")} onSaveError={() => saveFailed("slot")} save={async rows => store("slot", "", { action: "saveSlotRows", rows })} />
          </div>
          {activeSlot && <ClassCalendarPanel classes={[activeSlot, ...childSlots]} selectedClass={activeSlot}
            expectedVisits={activeProduct.design.booking === "fixed" ? activeProduct.design.monthlyVisits : undefined} onSaved={() => saved()} />}
          <button type="button" className={button} onClick={() => navigate(2)}>ほかのクラス・開催日を設定</button>
        </section>}
      </>}
      {step === 3 && <>
        {registrationIssues.length > 0 && <section className="grid gap-2 rounded-lg bg-amber-50 p-3 text-sm" aria-label="入会方法で必要な設定">
          <h4 className="font-semibold">次へ進むために必要な設定</h4>
          <ul className="grid gap-1">{registrationIssues.map(issue => <li key={issue}>{issue}</li>)}</ul>
        </section>}
        <div data-setup-block="recruitment"><ClassRecruitmentPanel view="settings" classes={school.classes} products={management.products} onOpenSettings={() => navigate(3)} hidePublication
          onOfferDraftChange={() => markDirty("offer")} onOfferSaved={() => saved("offer")} onOfferSaveError={() => saveFailed("offer")}
          onDraftChange={() => markDirty("recruitment")} onSaveError={() => saveFailed("recruitment")} onSaved={action => saved(action === "settings" ? "recruitment" : undefined)} /></div>
        {usesBriefing && <div data-setup-block="briefing" onChangeCapture={() => markDirty("briefing")}>
          <ClassAdmissionBlueprint schoolId={schoolId} schoolName={school.name} guided onSaveError={() => saveFailed("briefing")} onSaved={() => saved("briefing")} />
        </div>}
        <details className={panel}>
          <summary className="cursor-pointer font-semibold">規約・テスト・代理申込者</summary>
          <div data-setup-block="terms" onChangeCapture={() => markDirty("terms")}><ClassAdmissionsPanel mode="settings" onSaveError={() => saveFailed("terms")} onSaved={() => saved("terms")} /></div>
        </details>
      </>}
      {step === 4 && <>
        <section className={panel} aria-label="紹介ページの確認">
          <ClassBusinessFrontView name={school.name} introduction={draft.introduction} links={selected} />
        </section>
        <ClassRecruitmentPanel view="preview" classes={school.classes} products={management.products} onOpenSettings={() => navigate(3)} />
        <section className={panel}>
          <h4 className="font-semibold">申込後の対応</h4>
          <p className="text-sm">{intake?.route === "briefing"
            ? "説明会・体験の後、先生が入会案内を送ります。申込者が同意した後、先生が名簿に登録します。"
            : "直接申込を受け付けた後、先生が申込内容・同意・初日を確認し、名簿に登録します。"}</p>
          <p className="text-sm">{intake?.payment_mode === "advance" ? "オンライン支払いは指定した決済ページへの案内です。入金確認は先生が行います。" : intake?.payment_mode === "onsite" ? "現地支払いの案内を送ります。" : "初回の支払いは無料の設定です。"}</p>
          {intake?.route === "direct" && <p className="text-sm">直接申込の公開フォームは名前とメールを受け付けます。住所などの追加項目や、PARARI登録からの一括手続きは今後の対応です。</p>}
          {intake?.route === "briefing" && !admissions.briefingDesign && <p className="text-sm text-amber-900">説明会後の申込書が未設定です。「入会方法」で受講対象・必要項目を保存してください。</p>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />紹介・日程・申込画面と、申込後に先生が行う対応を確認した</label>
        </section>
      </>}
      {step === 5 && <>
        <ClassRecruitmentPanel view="settings" publicationOnly classes={school.classes} products={management.products} onOpenSettings={() => navigate(3)} onSaved={() => saved(undefined, false)} onOfferSaved={() => saved(undefined, false)} />
        <div data-setup-block="front" onChangeCapture={() => markDirty("front")}>
          <ClassBusinessFrontPanel schoolId={schoolId} name={school.name} products={products} guided publicationBlockers={publicationBlockers} availableLinks={front.links}
            onOpenRecruitment={() => navigate(3)} onOpenSchedule={() => navigate(2)} onSaveError={() => saveFailed("front")} onSaved={() => saved("front")} />
        </div>
        <p className="text-sm text-neutral-600">公開URLをLINE・SNS・ご自身のWebサイトで案内できます。公開後の申込は「日々の運営 → 申込・入会対応」で確認します。</p>
      </>}
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      {step > 0 && <button type="button" className={button} disabled={busy || loading || savingChanges} onClick={() => navigate(step - 1)}>前へ</button>}
      <span className="text-sm text-neutral-600" role="status">{loading ? "保存状態を確認しています…" : dirty.length ? dirty.map(block => blockLabels[block]).join("・") + "が未保存です" : statuses[step]}</span>
      {step < classSetupSteps.length - 1
        ? <button type="button" className={primary} disabled={busy || loading || savingChanges || (!ready[step] && !dirty.length)} onClick={() => navigate(step + 1)}>次へ · {classSetupSteps[step + 1].title}</button>
        : <button type="button" className={primary} disabled={busy || loading || savingChanges} onClick={() => navigate("operate")}>日々の運営へ</button>}
    </footer>
  </div>;
}
