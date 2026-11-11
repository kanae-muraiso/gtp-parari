"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SaveApplicationWizardDraft from "./SaveApplicationWizardDraft";

type Kind = "event" | "booking" | "sale" | "class";
type PanelKey = "intro" | "schedule" | "capacity" | "payment" | "form";
type Data = {
  kind: Kind;
  title: string;
  description: string;
  date: string;
  startTime: string;
  durationMinutes: string;
  place: string;
  cadence: string;
  attendance: string;
  capacity: string;
  price: string;
  payment: string;
  access: string;
  extraQuestion: string;
  notes: string;
};
const defaults: Data = {
  kind: "event", title: "", description: "", date: "", startTime: "", durationMinutes: "60", place: "",
  cadence: "once", attendance: "per_event", capacity: "", price: "0",
  payment: "onsite", access: "public", extraQuestion: "", notes: "",
};
const kinds: { id: Kind; label: string; examples: string; icon: string }[] = [
  { id: "event", label: "イベントを開催", examples: "バザー・パーティ・単発レッスン", icon: "◇" },
  { id: "booking", label: "予約を受け付ける", examples: "説明会・個人相談・面談", icon: "◷" },
  { id: "sale", label: "作品・商品を販売", examples: "電子書籍・写真・手作り作品", icon: "▣" },
  { id: "class", label: "クラスを運営", examples: "ZUMBA・生け花・英会話", icon: "◎" },
];
const panelLabels: Record<PanelKey, string> = {
  intro: "紹介", schedule: "日時・場所", capacity: "参加・受付条件",
  payment: "料金・支払方法", form: "申込・追加質問",
};
const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-amber-600 focus:outline-none";
const cardClass = "rounded-xl border border-slate-200 bg-white p-4";
const buttonClass = "rounded-lg bg-amber-700 px-5 py-2.5 font-medium text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-slate-300";

export default function ApplicationV2Prototype() {
  const [data, setData] = useState<Data>(defaults);
  const [step, setStep] = useState(0);
  const [panelOrder, setPanelOrder] = useState<PanelKey[]>(["intro", "schedule", "capacity", "payment", "form"]);
  const [view, setView] = useState<"edit" | "visitor">("edit");
  const patch = <K extends keyof Data>(key: K, value: Data[K]) => setData(old => ({ ...old, [key]: value }));
  const isSale = data.kind === "sale";
  const isBooking = data.kind === "booking";
  const isClass = data.kind === "class";
  const isPaid = Number(data.price) > 0;
  const hasSchedule = !isSale || data.cadence !== "none";
  const panels = useMemo(() => panelOrder.filter(key =>
    (key !== "schedule" || hasSchedule) &&
    (key !== "capacity" || !isSale) &&
    (key !== "payment" || isPaid || data.payment === "onsite") &&
    (key !== "form" || !isSale || Boolean(data.extraQuestion.trim()))
  ), [panelOrder, hasSchedule, isSale, isPaid, data.payment, data.extraQuestion]);
  function move(key: PanelKey, delta: number) {
    setPanelOrder(old => {
      const current = [...old];
      const from = current.indexOf(key);
      const to = current.indexOf(panels[panels.indexOf(key) + delta]);
      if (to < 0 || from < 0) return old;
      [current[from], current[to]] = [current[to], current[from]];
      return current;
    });
  }
  const endTime = (() => {
    if (!/^\\d{2}:\\d{2}$/.test(data.startTime)) return "";
    const [hours, minutes] = data.startTime.split(":").map(Number);
    const duration = Number(data.durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) return "";
    const total = hours * 60 + minutes + duration;
    const dayOffset = Math.floor(total / 1440);
    const clock = `${String(Math.floor((total % 1440) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    return clock + (dayOffset ? `（翌日+${dayOffset}日）` : "");
  })();
  const cadenceLabel = data.cadence === "weekly" ? "毎週" : data.cadence === "daily" ? "毎日" : data.cadence === "custom" ? "日程を個別に指定" : "1回のみ";
  const priceLabel = isPaid ? `${Number(data.price).toLocaleString("ja-JP")}円` : "無料";
  const paymentLabel = !isPaid ? "支払い不要" : data.payment === "online" ? "オンライン事前決済" : "現地・個別支払い";
  const progress = ["入口", "内容", "日時・提供", "受付条件", "料金・質問", "レイアウト"];
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <Link href="/my/works" className="text-sm text-amber-800 underline">← STUDIOに戻る</Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">APPLICATION v2 試作</h1>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold">公開・決済なし（下書き保存可）</span>
          </div>
          <p className="text-sm text-slate-600">4つの入口から始め、質問に答えるだけで案内パネルを構成する操作実験です。保存ボタンを押すまではサーバーへ送信されません。</p>
        </header>
        <nav aria-label="作成手順" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {progress.map((p, i) => (
            <div key={p} className={`rounded-lg px-2 py-2 text-center text-xs ${step === i ? "bg-amber-100 font-semibold text-amber-900" : "bg-white text-slate-500"}`}>
              {i + 1}. {p}
            </div>
          ))}
        </nav>
        {step === 0 && (
          <section className={cardClass}>
            <h2 className="mb-1 text-lg font-semibold">何を始めますか？</h2>
            <p className="mb-4 text-sm text-slate-600">近いものを選んでください。これは最初の質問の順番を決めるだけで、機能の制限ではありません。</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {kinds.map(kind => (
                <button key={kind.id} type="button" onClick={() => setData(old => ({ ...old, kind: kind.id, cadence: kind.id === "sale" ? "none" : "once" }))}
                  aria-pressed={data.kind === kind.id}
                  className={`rounded-xl border p-4 text-left ${data.kind === kind.id ? "border-amber-700 bg-amber-50" : "border-slate-200 bg-white"}`}>
                  <div className="text-xl">{kind.icon}</div>
                  <div className="font-semibold">{kind.label}</div>
                  <div className="mt-1 text-xs text-slate-600">{kind.examples}</div>
                </button>
              ))}
            </div>
          </section>
        )}
        {step === 1 && (
          <section className={cardClass + " space-y-4"}>
            <h2 className="text-lg font-semibold">{isSale ? "何を販売しますか？" : isClass ? "どんなクラスですか？" : isBooking ? "何の予約を受け付けますか？" : "どんなイベントですか？"}</h2>
            <label className="block space-y-1 text-sm"><span>名称</span>
              <input className={inputClass} value={data.title} onChange={e => patch("title", e.target.value)} placeholder={isSale ? "例：写真集" : "例：金曜夜のZUMBA"} />
            </label>
            <label className="block space-y-1 text-sm"><span>内容・紹介（自由記述）</span>
              <textarea className={inputClass} rows={4} value={data.description} onChange={e => patch("description", e.target.value)} placeholder="参加者・購入者に伝えたいこと" />
            </label>
          </section>
        )}
        {step === 2 && (
          <section className={cardClass + " space-y-4"}>
            <h2 className="text-lg font-semibold">{isSale ? "どのように提供しますか？" : isBooking ? "いつ予約できますか？" : "いつ、どこで開催しますか？"}</h2>
            <label className="block space-y-1 text-sm"><span>{isSale ? "提供方法" : "開催パターン"}</span>
              <select className={inputClass} value={data.cadence} onChange={e => patch("cadence", e.target.value)}>
                {isSale ? <><option value="none">日時の指定なし（通常販売）</option><option value="once">日時を指定する（チケット等）</option></> :
                  <><option value="once">1回のみ</option><option value="weekly">毎週</option><option value="daily">毎日</option><option value="custom">日程を個別に指定</option></>}
              </select>
            </label>
            {hasSchedule && <>
              <p className="text-xs text-slate-600">日程と繰り返しは操作フローの確認用です。予約枠の生成・重複検査はこの試作では行いません。</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm"><span>{data.cadence === "once" ? "開催日" : "開始日・例示日"}</span>
                  <input type="date" className={inputClass} value={data.date} onChange={e => patch("date", e.target.value)} /></label>
                <label className="block space-y-1 text-sm"><span>開始時刻</span>
                  <input type="time" className={inputClass} value={data.startTime} onChange={e => patch("startTime", e.target.value)} /></label>
                <label className="block space-y-1 text-sm"><span>所要時間</span>
                  <select className={inputClass} value={data.durationMinutes} onChange={e => patch("durationMinutes", e.target.value)}>
                    {[15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 360, 480].map(minutes => <option key={minutes} value={minutes}>{minutes >= 60 ? `${Math.floor(minutes / 60)}時間${minutes % 60 ? `${minutes % 60}分` : ""}` : `${minutes}分`}</option>)}
                  </select></label>
              </div>
              <p className="text-sm text-slate-600">終了時刻：{endTime || "開始時刻を選択してください"}（自動計算）</p>
              <label className="block space-y-1 text-sm"><span>会場・提供場所</span>
                <input className={inputClass} value={data.place} onChange={e => patch("place", e.target.value)} placeholder="例：京都市内 / オンライン" /></label>
            </>}
            {isSale && !hasSchedule && <label className="block space-y-1 text-sm"><span>提供についての補足（自由記述）</span><textarea className={inputClass} value={data.notes} onChange={e => patch("notes", e.target.value)} rows={3} placeholder="ダウンロード・配送・手渡し等" /></label>}
          </section>
        )}
        {step === 3 && (
          <section className={cardClass + " space-y-4"}>
            <h2 className="text-lg font-semibold">{isSale ? "誰に販売しますか？" : "誰が、どのように参加できますか？"}</h2>
            <label className="block space-y-1 text-sm"><span>公開範囲</span>
              <select className={inputClass} value={data.access} onChange={e => patch("access", e.target.value)}>
                <option value="public">誰でも見ることができる</option>
                <option value="unlisted">URLを知っている人だけに案内する</option>
                <option value="restricted">登録・確認済みの人に限定する（実装時に権限設定が必要）</option>
              </select>
            </label>
            {!isSale && <label className="block space-y-1 text-sm"><span>{isBooking ? "1枠あたりの定員" : "定員（未入力なら指定なし）"}</span>
              <input type="number" min="1" className={inputClass} value={data.capacity} onChange={e => patch("capacity", e.target.value)} placeholder="例：30" />
            </label>}
            {isClass && <label className="block space-y-1 text-sm"><span>受講者の参加方式</span>
              <select className={inputClass} value={data.attendance} onChange={e => patch("attendance", e.target.value)}>
                <option value="per_event">開催回ごとに自由参加</option>
                <option value="fixed">決まった受講者のみ</option>
                <option value="mixed">既存受講者＋新規募集</option>
              </select>
            </label>}
            {isBooking && <div className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">受付可能な時間を随時増減する操作は、CALENDAR連携の実装段階で行います。</div>}
            <p className="text-xs text-slate-600">限定URLは厳密なアクセス制限ではありません。公開範囲と参加受付条件は別々に扱います。</p>
          </section>
        )}
        {step === 4 && (
          <section className={cardClass + " space-y-4"}>
            <h2 className="text-lg font-semibold">料金と質問を設定しましょう</h2>
            <label className="block space-y-1 text-sm"><span>{isSale ? "販売価格（円）" : "参加料金（円・無料は0）"}</span>
              <input type="number" min="0" className={inputClass} value={data.price} onChange={e => patch("price", e.target.value)} />
            </label>
            {isPaid && <label className="block space-y-1 text-sm"><span>支払方法</span>
              <select className={inputClass} value={data.payment} onChange={e => patch("payment", e.target.value)}>
                <option value="onsite">現地・個別支払い</option><option value="online">オンライン事前決済（実際の連携は未実装）</option>
              </select>
            </label>}
            <label className="block space-y-1 text-sm"><span>参加者・購入者に尋ねたいこと（任意）</span>
              <input className={inputClass} value={data.extraQuestion} onChange={e => patch("extraQuestion", e.target.value)} placeholder="例：経験年数を教えてください" />
            </label>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <strong>重要：</strong>追加質問や自由記述は表示・回答収集のためだけのものです。料金・定員・予約可否・決済条件には反映しません。申込時の正式な条件は基本設定で指定してください。
            </div>
          </section>
        )}
        {step === 5 && (
          <section className="space-y-4">
            <div className={cardClass + " space-y-3"}>
              <h2 className="text-lg font-semibold">パネルを自動構成しました</h2>
              <p className="text-sm text-slate-600">パネルの追加・削除はできません。順番の変更と紹介・補足文の編集だけができます。日時・料金・定員は前の質問に戻って修正します。</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setView("edit")} className={`rounded-lg px-4 py-2 text-sm ${view === "edit" ? "bg-amber-700 text-white" : "bg-slate-100"}`}>構成を整える</button>
                <button type="button" onClick={() => setView("visitor")} className={`rounded-lg px-4 py-2 text-sm ${view === "visitor" ? "bg-amber-700 text-white" : "bg-slate-100"}`}>参加者の表示</button>
              </div>
            </div>
            {panels.map((key, index) => (
              <div key={key} className={cardClass + " space-y-2"}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{panelLabels[key]}</h3>
                  {view === "edit" && <div className="flex gap-1">
                    <button type="button" disabled={index === 0} onClick={() => move(key, -1)} aria-label={`${panelLabels[key]}を上へ`} className="rounded border px-3 py-1 disabled:opacity-30">↑</button>
                    <button type="button" disabled={index === panels.length - 1} onClick={() => move(key, 1)} aria-label={`${panelLabels[key]}を下へ`} className="rounded border px-3 py-1 disabled:opacity-30">↓</button>
                  </div>}
                </div>
                {key === "intro" && <>
                  <p className="font-medium">{data.title || "名称未入力"}</p>
                  {view === "edit" ? <textarea className={inputClass} value={data.description} onChange={e => patch("description", e.target.value)} rows={3} placeholder="自由に紹介文を書けます" /> :
                    <p className="whitespace-pre-wrap text-sm">{data.description || "紹介文がありません"}</p>}
                </>}
                {key === "schedule" && <p className="text-sm">{cadenceLabel} ／ {data.date || "日付未設定"} ／ {data.startTime ? `${data.startTime}〜${endTime}` : "開始時刻未設定"} ／ {data.place || "場所未設定"}</p>}
                {key === "capacity" && <p className="text-sm">定員：{data.capacity ? `${data.capacity}名` : "指定なし"} ／ 公開：{data.access === "public" ? "一般公開" : data.access === "unlisted" ? "URL限定" : "参加資格者に限定"}{isClass ? ` ／ ${data.attendance === "fixed" ? "固定受講者" : data.attendance === "mixed" ? "固定＋新規募集" : "自由参加"}` : ""}</p>}
                {key === "payment" && <p className="text-sm">{priceLabel} ／ {paymentLabel}</p>}
                {key === "form" && <div className="space-y-2 text-sm"><p>氏名・メールアドレスを受け付けます。</p>{data.extraQuestion && <p>追加質問：{data.extraQuestion}</p>}<p className="text-xs text-slate-500">この試作で申込・課金はできません。</p></div>}
                {key === "intro" && view === "edit" && <p className="text-xs text-slate-500">自由記述以外の条件は質問画面に戻って変更してください。</p>}
              </div>
            ))}
            <div className={cardClass + " space-y-2"}>
              <label className="block space-y-1 text-sm"><span>補足案内（自由記述）</span>
                {view === "edit" ? <textarea className={inputClass} rows={3} value={data.notes} onChange={e => patch("notes", e.target.value)} placeholder="持ち物・アクセス・注意事項など" /> :
                  <p className="whitespace-pre-wrap">{data.notes || "補足なし"}</p>}
              </label>
              <p className="text-xs text-slate-600">この文章によって申込条件や決済条件は変わりません。</p>
            </div>
          </section>
        )}
        <div className={step === 5 ? "" : "hidden"}><SaveApplicationWizardDraft data={data} panelOrder={panels} /></div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <button type="button" onClick={() => setStep(x => Math.max(0, x - 1))} disabled={step === 0} className="rounded-lg border border-slate-300 px-5 py-2.5 disabled:opacity-40">戻る</button>
          {step < 5 ? <button type="button" onClick={() => setStep(x => Math.min(5, x + 1))} className={buttonClass}>次へ</button> :
            <button type="button" className={buttonClass} onClick={() => { setStep(0); setData(defaults); setPanelOrder(["intro", "schedule", "capacity", "payment", "form"]); setView("edit"); }}>別の入口を試す</button>}
        </footer>
        <p className="text-center text-xs text-slate-500">質問型UIから既存APPLICATIONの下書き保存に対応。CALENDAR・FORM作成と実際の予約・決済・PAGE公開は別工程です。</p>
      </div>
    </main>
  );
}
