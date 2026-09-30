"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SaveJob = () => Promise<void>;
type SaveContext = { queueSave: (job: SaveJob) => () => void; flush: () => Promise<boolean> };
const Context = createContext<SaveContext | null>(null);

export function useOptionalCppSave() { return useContext(Context); }

export function useCppSave() {
  const value = useContext(Context);
  if (!value) throw new Error("CPP editor must be inside CppSaveBoundary");
  return value;
}

export default function CppSaveBoundary({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const jobs = useRef(new Set<SaveJob>());
  const running = useRef<Promise<boolean> | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const queueSave = useCallback((job: SaveJob) => {
    jobs.current.add(job);
    return () => { jobs.current.delete(job); };
  }, []);
  const flush = useCallback((): Promise<boolean> => {
    if (running.current) return running.current;
    running.current = (async () => {
      setSaving(true);
      setMessage("");
      try {
        for (const job of Array.from(jobs.current)) {
          await job();
          jobs.current.delete(job);
        }
        setMessage("保存しました。");
        return true;
      } catch (error) {
        setMessage(`保存できませんでした。入力を残しています。${error instanceof Error ? error.message : "再度お試しください。"}`);
        return false;
      } finally {
        setSaving(false);

      }
    })().finally(() => { running.current = null; });
    return running.current;
  }, []);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
      event.preventDefault();
      event.stopPropagation();
      if (running.current) return;
      void flush().then((ok) => {
        if (!ok) return;
        if (url.origin === location.origin) router.push(url.pathname + url.search + url.hash);
        else location.assign(url.href);
      });
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (jobs.current.size || running.current) { event.preventDefault(); event.returnValue = ""; }
    };
    // Back/forward navigation can be stopped before React unmounts the draft.
    type NavigationEvent = Event & { navigationType: string; destination: { key: string } };
    const navigation = (window as unknown as { navigation?: { addEventListener: (type: string, fn: (e: NavigationEvent) => void) => void; removeEventListener: (type: string, fn: (e: NavigationEvent) => void) => void; traverseTo: (key: string) => unknown } }).navigation;
    let approvedTraversal: string | null = null;
    const traverse = (event: NavigationEvent) => {
      if (event.navigationType !== "traverse" || !event.cancelable) return;
      if (approvedTraversal === event.destination.key) { approvedTraversal = null; return; }
      event.preventDefault();
      void flush().then((ok) => { if (ok) { approvedTraversal = event.destination.key; navigation?.traverseTo(approvedTraversal); } });
    };
    navigation?.addEventListener("navigate", traverse);
    document.addEventListener("click", click, true);
    window.addEventListener("beforeunload", unload);
    return () => { document.removeEventListener("click", click, true); window.removeEventListener("beforeunload", unload); navigation?.removeEventListener("navigate", traverse); };
  }, [flush, router]);
  return <Context.Provider value={{ queueSave, flush }}>
    <div aria-live="polite" className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-sky-50 px-4 py-2 text-sm text-sky-900">
      <span>{saving ? "保存しています…" : message || "ページを移動するときに保存します。"}</span>
      <button type="button" disabled={saving} onClick={() => void flush()} className="shrink-0 rounded-full border border-sky-300 px-3 py-1 text-xs font-bold">今すぐ保存</button>
    </div>
    <fieldset disabled={saving} className="min-w-0 border-0 p-0">{children}</fieldset>
  </Context.Provider>;
}
