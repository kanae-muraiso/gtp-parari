// src/components/parari/PublicWorkLoader.tsx
// 2026-10-08 JST / PART: Load authorized display data into the one existing viewer
"use client";
import React from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ReaderLocator, ReaderResponse } from "@/lib/commerce/readerAccess";
import PublicViewerShell from "./PublicViewerShell";
import BookViewTracker from "./BookViewTracker";
export default function PublicWorkLoader({ id, username, workSlug, pageSlug }: ReaderLocator) {
    const [result, setResult] = React.useState<ReaderResponse | null>(null);
    const [error, setError] = React.useState("");
    const [revision, refresh] = React.useReducer(n => n + 1, 0);
    React.useEffect(() => {
        let cancelled = false;
        let controller: AbortController | null = null;
        async function load() {
            controller?.abort();
            controller = new AbortController();
            const current = controller;
            setResult(null);
            setError("");
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (cancelled || current.signal.aborted)
                    return;
                const p = new URLSearchParams();
                for (const [key, value] of Object.entries({ id, username, workSlug, pageSlug }))
                    if (value)
                        p.set(key, value);
                const res = await fetch(`/api/works/read?${p}`, { cache: "no-store", signal: current.signal, headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} });
                const data = await res.json();
                if (!res.ok)
                    throw new Error(data.message || "読み込めませんでした。");
                if (!cancelled && !current.signal.aborted)
                    setResult(data);
            }
            catch (e) {
                if (!cancelled && !current.signal.aborted)
                    setError(e instanceof Error ? e.message : "読み込めませんでした。");
            }
        }
        void load();
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { setResult(null); queueMicrotask(() => { if (!cancelled)
            void load(); }); });
        return () => { cancelled = true; controller?.abort(); subscription.unsubscribe(); };
    }, [id, username, workSlug, pageSlug, revision]);
    if (!result)
        return <main className="mx-auto max-w-xl p-8"><p role="status">{error || "作品を読み込んでいます…"}</p>{error ? <button className="mt-4 underline" onClick={() => refresh()}>再読み込み</button> : null}</main>;
    const returnTo = typeof window === "undefined" ? `/p/${result.id}` : window.location.pathname + window.location.search + window.location.hash;
    return <><BookViewTracker bookId={result.id}/><PublicViewerShell bookId={result.id} ownerId={result.owner} pageSlug={pageSlug} preparedDocument={result.document}/>
 {result.locked ? <section id="paid-boundary" className="mx-auto my-8 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
 <h2 className="text-xl font-bold">ここから先は有料です</h2><p className="mt-3 text-sm">購入または対象の購読で、続きをお読みいただけます。</p>
 <div className="mt-5 flex flex-col gap-3">{result.products.map(product => <a key={product.id} className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-bold text-white" href={`/buy/${product.id}?returnTo=${encodeURIComponent(returnTo)}`}>{product.billing_interval === "monthly" ? "購読する" : "この作品を購入する"} · {new Intl.NumberFormat("ja-JP", { style: "currency", currency: product.currency }).format(Number(product.amount))}{product.billing_interval === "monthly" ? "／月" : ""}</a>)}</div>
 {!result.products.length ? <p className="mt-4 text-sm">販売準備中です。</p> : null}
 <p className="mt-5 text-sm"><a className="underline" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>購入・購読済みの方はログイン</a></p>
 <button className="mt-3 text-sm underline" onClick={() => refresh()}>決済の反映を確認する</button>
 </section> : null}</>;
}
