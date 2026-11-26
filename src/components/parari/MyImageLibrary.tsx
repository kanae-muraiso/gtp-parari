"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type ImageFile = {
  name: string;
  path: string;
  created_at?: string | null;
};

type ImageReferences = {
  works: Array<{ id: string; title: string }>;
};

export default function MyImageLibrary() {
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(60);
  const [references, setReferences] = useState<Record<string, ImageReferences>>({});
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [checkingPath, setCheckingPath] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) throw new Error("ログインしてください。");
        const pending = [userData.user.id];
        const collected: ImageFile[] = [];

        while (pending.length > 0) {
          const batch = pending.splice(0, 8);
          const results = await Promise.all(batch.map(async (folder) => {
            const childFolders: string[] = [];
            const folderFiles: ImageFile[] = [];
            let offset = 0;
            let hasNext = true;
            while (hasNext) {
              const { data, error: listError } = await supabase.storage.from("parari-images").list(folder, {
                limit: 100,
                offset,
                sortBy: { column: "created_at", order: "desc" },
              });
              if (listError) throw new Error(listError.message);
              const entries = data ?? [];
              for (const item of entries) {
                if (item.id === null) {
                  childFolders.push(folder + "/" + item.name);
                } else if ((item.metadata?.mimetype ?? "").startsWith("image/") || /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(item.name)) {
                  folderFiles.push({ name: item.name, path: folder + "/" + item.name, created_at: item.created_at });
                }
              }
              hasNext = entries.length === 100;
              offset += entries.length;
            }
            return { childFolders, folderFiles };
          }));
          for (const result of results) {
            pending.push(...result.childFolders);
            collected.push(...result.folderFiles);
          }
        }

        collected.sort((a, b) => {
          const difference = new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
          return difference || a.path.localeCompare(b.path);
        });
        if (!cancelled) {
          setFiles(collected);
          setVisibleCount(60);
          setReferences({});
        }
      } catch (cause: any) {
        if (!cancelled) setError(cause?.message ?? "画像を読み込めませんでした。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const requestReferences = async (path: string) => {
    if (expandedPath === path) {
      setExpandedPath(null);
      return;
    }
    setExpandedPath(path);
    if (references[path] || checkingPath) return;

    setCheckingPath(path);
    setError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error("ログイン状態を確認できませんでした。");
      const response = await fetch("/api/parari/images/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ action: "references", paths: [path] }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok || !Array.isArray(result.works)) {
        throw new Error(result?.message ?? "使用作品を確認できませんでした。");
      }
      setReferences((current) => ({ ...current, [path]: { works: result.works } }));
    } catch (cause: any) {
      setError(cause?.message ?? "使用作品を確認できませんでした。");
      setExpandedPath(null);
    } finally {
      setCheckingPath(null);
    }
  };

  const deleteImage = async (path: string) => {
    if (!references[path] || references[path].works.length > 0 || deletingPath) return;
    if (!window.confirm("作品では使用されていない画像です。削除しますか？削除前に、ほかの設定での使用状況も確認します。")) return;
    setDeletingPath(path);
    setError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error("ログイン状態を確認できませんでした。");
      const response = await fetch("/api/parari/images/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ action: "delete", paths: [path] }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.message ?? "画像を削除できませんでした。");
      setFiles((current) => current.filter((file) => file.path !== path));
      setExpandedPath(null);
    } catch (cause: any) {
      setError(cause?.message ?? "画像を削除できませんでした。");
    } finally {
      setDeletingPath(null);
    }
  };

  const copyImageUrl = async (path: string) => {
    const url = supabase.storage.from("parari-images").getPublicUrl(path).data.publicUrl;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPath(path);
      window.setTimeout(() => setCopiedPath((current) => current === path ? null : current), 1500);
    } catch {
      window.prompt("画像URLをコピーしてください", url);
    }
  };

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">MY IMAGES</div>
          <h2 className="mt-2 text-xl font-bold text-neutral-950">マイ画像</h2>
          <p className="mt-2 text-sm leading-7 text-neutral-500">アップロード済み画像を確認し、使用作品の確認や再利用ができます。使用状況は画像ごとに必要なときだけ読み込みます。</p>
        </div>
        <Link href="/my/works" className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50">作品一覧へ</Link>
      </div>

      {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="py-12 text-center text-sm text-neutral-500">画像を読み込んでいます…</p> : null}
      {!loading && files.length === 0 && !error ? <p className="py-12 text-center text-sm text-neutral-500">アップロード済みの画像はありません。</p> : null}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {files.slice(0, visibleCount).map((file) => {
          const url = supabase.storage.from("parari-images").getPublicUrl(file.path).data.publicUrl;
          const details = references[file.path];
          const expanded = expandedPath === file.path;
          return (
            <article key={file.path} className="overflow-hidden rounded-xl border border-neutral-200">
              <img src={url} alt={file.name} className="aspect-square w-full bg-neutral-100 object-cover" loading="lazy" />
              <div className="p-3">
                <div className="truncate text-[11px] font-semibold text-neutral-700" title={file.name}>{file.name}</div>
                <div className="mt-1 text-[10px] text-neutral-500">{file.created_at ? new Date(file.created_at).toLocaleDateString("ja-JP") : "アップロード済み"}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void copyImageUrl(file.path)} className="rounded-full border border-neutral-200 px-2.5 py-1 text-[10px] font-bold text-neutral-700 hover:bg-neutral-50">{copiedPath === file.path ? "コピー済み" : "URLをコピー"}</button>
                  <button type="button" disabled={checkingPath !== null} onClick={() => void requestReferences(file.path)} className="rounded-full border border-neutral-200 px-2.5 py-1 text-[10px] font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">{checkingPath === file.path ? "確認中…" : expanded ? "使用作品を閉じる" : "使用作品を見る"}</button>
                </div>
                {expanded && details ? (
                  <div className="mt-3 border-t border-neutral-100 pt-2">
                    {details.works.length > 0 ? (
                      <>
                        <p className="text-[10px] font-bold text-neutral-500">使用中（{details.works.length}作品）</p>
                        <ul className="mt-1 space-y-1">
                          {details.works.map((work) => <li key={work.id}><Link href={"/editor-v2/" + work.id} className="block truncate text-[11px] text-blue-700 hover:underline">{work.title}</Link></li>)}
                        </ul>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] font-bold text-emerald-700">作品では未使用</p>
                        <button type="button" disabled={deletingPath === file.path} onClick={() => void deleteImage(file.path)} className="mt-2 rounded-full border border-red-200 px-3 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">{deletingPath === file.path ? "削除中…" : "削除"}</button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      {!loading && files.length > visibleCount ? <div className="pt-5 text-center"><button type="button" onClick={() => setVisibleCount((count) => count + 60)} className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-bold text-neutral-600">さらに表示</button></div> : null}
    </section>
  );
}
