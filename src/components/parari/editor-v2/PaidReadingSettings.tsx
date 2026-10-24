// src/components/parari/editor-v2/PaidReadingSettings.tsx
// 2026-10-08 JST / PART: Link the SSOT boundary to existing seller products
"use client";
import React from "react";
import { supabase } from "@/lib/supabaseClient";
import { splitPaidContent } from "@/lib/commerce/paywall";
type Product = {
    id: string;
    name: string;
    work_id: string | null;
    billing_interval: string;
    active: boolean;
};
export function PaidReadingSettings({ workId, content }: {
    workId: string;
    content: string;
}) {
    const [open, setOpen] = React.useState(false), [products, setProducts] = React.useState<Product[]>([]);
    const [once, setOnce] = React.useState(""), [monthly, setMonthly] = React.useState("");
    const [message, setMessage] = React.useState(""), [busy, setBusy] = React.useState(false), [loaded, setLoaded] = React.useState(false);
    async function request(save: boolean, signal?: AbortSignal) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session)
            throw new Error("ログイン状態を確認してください。");
        const response = await fetch(`/api/commerce/work-access?workId=${encodeURIComponent(workId)}`, { method: save ? "POST" : "GET", signal, headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, ...(save ? { body: JSON.stringify({ workId, oneTimeProductId: once, subscriptionProductId: monthly }) } : {}) });
        const result = await response.json();
        if (!response.ok)
            throw new Error(result.message);
        return result;
    }
    React.useEffect(() => {
        if (!open)
            return;
        const controller = new AbortController();
        setLoaded(false);
        setBusy(true);
        setMessage("");
        void request(false, controller.signal).then(r => { if (controller.signal.aborted)
            return; setProducts(r.products); setOnce(r.mapping?.one_time_product_id ?? ""); setMonthly(r.mapping?.subscription_product_id ?? ""); setLoaded(true); }).catch(e => { if (!controller.signal.aborted)
            setMessage(e.message); }).finally(() => { if (!controller.signal.aborted)
            setBusy(false); });
        return () => controller.abort();
    }, [open, workId]);
    async function save() { setBusy(true); setMessage(""); try {
        await request(true);
        setMessage("販売設定を保存しました。本文の変更は作品の保存ボタンで保存してください。");
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : "保存できませんでした。");
    }
    finally {
        setBusy(false);
    } }
    return <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-4"><button type="button" className="text-sm font-bold" aria-expanded={open} onClick={() => setOpen(!open)}>有料の続きを読む設定 {open ? "−" : "＋"}</button>
 {open ? <div className="mt-4 space-y-4 text-sm"><p>本文の「＋ → パネル → ここから先は有料」で境界を一つ置き、下の商品を選びます。境界より前は無料、後は購入者・対象の購読者が読めます。</p>
 {!splitPaidContent(content).hasPaywall ? <p className="text-amber-800">まだ有料境界がありません。商品を選んでも本文は有料になりません。</p> : null}
 <label className="block">単品購入<select className="mt-1 block w-full rounded border p-2" disabled={!loaded || busy} value={once} onChange={e => setOnce(e.target.value)}><option value="">利用しない</option>{products.filter(p => p.work_id === workId && p.billing_interval === "one_time").map(p => <option value={p.id} key={p.id}>{p.name}{p.active ? "" : "（販売停止中）"}</option>)}</select></label>
 <label className="block">月額購読<select className="mt-1 block w-full rounded border p-2" disabled={!loaded || busy} value={monthly} onChange={e => setMonthly(e.target.value)}><option value="">利用しない</option>{products.filter(p => p.billing_interval === "monthly").map(p => <option value={p.id} key={p.id}>{p.name}{p.active ? "" : "（販売停止中）"}</option>)}</select></label>
 <p>同じ購読商品を複数の作品に設定できます。月額販売はOrganizer以上です。対象の購読を変更すると、旧購読での閲覧も変わります。</p>
 <a className="underline" href="/my/sales" target="_blank" rel="noopener noreferrer">商品・価格を登録する</a><p>登録後はこの設定を閉じて開くと、商品一覧が更新されます。</p>
 <button type="button" className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-40" disabled={!loaded || busy} onClick={() => void save()}>{busy ? "処理中…" : "販売設定を保存"}</button>
 <p role="status">{message}</p></div> : null}</section>;
}
