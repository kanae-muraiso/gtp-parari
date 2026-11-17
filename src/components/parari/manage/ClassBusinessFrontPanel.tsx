"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ClassBusinessFrontView from "@/components/parari/classes/ClassBusinessFrontView";
import { classRequest } from "@/lib/classRequests";
import {
  classBusinessFrontPath, selectClassBusinessFrontLinks,
  type ClassBusinessFront, type ClassBusinessFrontContent, type ClassBusinessFrontLink,
} from "@/lib/classBusinessFront";

type FrontSettings = { front: ClassBusinessFront; links: ClassBusinessFrontLink[] };
type FrontAction = "saveFront" | "publishFront" | "unpublishFront";
const button = "w-fit rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-50";

export default function ClassBusinessFrontPanel({ schoolId, name, onOpenRecruitment, onOpenSchedule }: {
  schoolId: string; name: string; onOpenRecruitment: () => void; onOpenSchedule: () => void;
}) {
  const [settings, setSettings] = useState<FrontSettings | null>(null);
  const [content, setContent] = useState<ClassBusinessFrontContent>({ introduction: "", entries: [] });
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    void classRequest<FrontSettings>("/front", undefined, request.signal).then(result => {
      if (!request.signal.aborted) {
        setSettings(result);
        setContent(result.front.draft);
      }
    }).catch(() => { if (!request.signal.aborted) setError("フロントページの設定を取得できませんでした。"); });
    return () => request.abort();
  }, [schoolId, reload]);

  async function save(action: FrontAction) {
    if (!settings || busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { front } = await classRequest<{ front: ClassBusinessFront }>("/front", { action, revision: settings.front.revision, content });
      setSettings({ ...settings, front });
      if (action !== "unpublishFront") setContent(front.draft);
      setNotice({ saveFront: "下書きを保存しました。", publishFront: "フロントページを公開しました。",
        unpublishFront: "フロントページを非公開にしました。" }[action]);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "フロントページを保存できませんでした。");
      return false;
    } finally { setBusy(false); }
  }

  async function openSettings(open: () => void) {
    if (!settings) return;
    if (JSON.stringify(content) === JSON.stringify(settings.front.draft) || await save("saveFront")) open();
  }

  function retry() {
    setError("");
    setSettings(null);
    setReload(value => value + 1);
  }

  if (!settings) return <section className="grid gap-2 rounded-xl border p-4">
    <p role={error ? "alert" : "status"}>{error || "フロントページの設定を読み込んでいます…"}</p>
    {error && <button type="button" className={button} onClick={retry}>再読み込み</button>}
  </section>;

  const href = classBusinessFrontPath(schoolId);
  const chosen = selectClassBusinessFrontLinks(content.entries, settings.links);
  const unavailable = content.entries.length - chosen.length;
  return <section className="grid gap-4 rounded-xl border p-4" aria-labelledby="class-front-settings">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="class-front-settings" className="font-semibold">フロントページ</h3>
      <span className="text-sm text-neutral-600">{settings.front.published ? "公開中" : "非公開"}</span>
    </div>
    <fieldset className="grid min-w-0 gap-4" disabled={busy}>
      <label className="grid gap-1 text-sm">紹介文
        <textarea rows={4} maxLength={3000} className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          value={content.introduction} onChange={event => setContent({ ...content, introduction: event.target.value })} />
      </label>
      <fieldset className="grid gap-2 text-sm">
        <legend className="mb-2 font-medium">掲載項目</legend>
        {settings.links.map(link => <label key={link.key} className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={content.entries.includes(link.key)} onChange={event =>
            setContent({ ...content, entries: event.target.checked ? [...content.entries, link.key]
              : content.entries.filter(key => key !== link.key) })} />
          <span>{link.title}{link.title !== link.label && <span className="ml-2 text-neutral-600">{link.label}</span>}</span>
        </label>)}
        {!settings.links.length && <div className="grid gap-2">
          <p className="text-neutral-600">公開ページに載せたい内容から設定できます。</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} onClick={() => void openSettings(onOpenSchedule)}>日程・会場・参加費を見せる</button>
            <button type="button" className={button} onClick={() => void openSettings(onOpenRecruitment)}>申し込みを受け付ける</button>
          </div>
        </div>}
        {unavailable > 0 && <div className="flex flex-wrap items-center gap-2 text-neutral-600">
          <p>現在掲載できない項目が{unavailable}件あります。</p>
          <button type="button" className="underline" onClick={() => setContent({ ...content, entries: chosen.map(link => link.key) })}>
            掲載項目から外す
          </button>
        </div>}
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error} <button type="button" className="underline" onClick={retry}>再読み込み</button></p>}
      {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} aria-expanded={preview} onClick={() => setPreview(value => !value)}>
          {preview ? "プレビューを閉じる" : "プレビュー"}
        </button>
        <button type="button" className={button} onClick={() => void save("saveFront")}>下書きを保存</button>
        <button type="button" className="w-fit rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => void save("publishFront")}>{settings.front.published ? "変更を公開する" : "公開する"}</button>
        {settings.front.published && <button type="button" className={button} onClick={() => void save("unpublishFront")}>非公開にする</button>}
      </div>
    </fieldset>
    {settings.front.published && <div className="flex flex-wrap items-center gap-3 text-sm">
      <Link href={href} target="_blank" rel="noreferrer" className="underline">公開ページを開く</Link>
      <button type="button" className={button} onClick={async () => {
        setError("");
        setNotice("");
        try {
          await navigator.clipboard.writeText(new URL(href, window.location.origin).href);
          setNotice("公開URLをコピーしました。");
        } catch { setError("公開ページを開き、アドレスをコピーしてください。"); }
      }}>公開URLをコピー</button>
    </div>}
    {preview && <section aria-label="フロントページのプレビュー" className="rounded-xl bg-neutral-50 p-4 sm:p-6">
      <ClassBusinessFrontView name={name} introduction={content.introduction} links={chosen} />
    </section>}
  </section>;
}
