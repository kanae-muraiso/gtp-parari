"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type RegistrationStatus = {
  profile_exists: boolean;
  required_complete: boolean;
  missing_fields: string[];
  participating: boolean;
  admitted: boolean;
};

export default function CppResearcherEntryStatus({ editing = false }: { editing?: boolean }) {
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = async () => {
      const result = await supabase?.rpc("cpp_researcher_registration_status");
      if (!active) return;
      if (result?.error || !result?.data?.[0]) {
        setError("入室条件を確認できませんでした。ページを再読み込みしてください。");
        return;
      }
      setError("");
      setStatus(result.data[0] as RegistrationStatus);
    };
    void load();
    window.addEventListener("cpp-profile-saved", load);
    window.addEventListener("cpp-participation-changed", load);
    return () => {
      active = false;
      window.removeEventListener("cpp-profile-saved", load);
      window.removeEventListener("cpp-participation-changed", load);
    };
  }, []);

  return <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm leading-7 text-sky-950" aria-live="polite">
    <h2 className="font-bold">研究者としての入室</h2>
    {error ? <p role="alert">{error}</p> : !status ? <p>保存済みの内容を確認しています…</p> : !status.participating && !status.admitted ? <>
      <p>現在は「同窓会のみ」です。研究者としても参加する場合は、参加設定を変更してください。</p>
      <Link href="/my/cpp/participation" className="mt-2 inline-block font-bold underline">参加設定を開く</Link>
    </> : status.admitted ? <>
      <p>必須事項がそろい、研究者として入室できます。プロフィールが下書きでもBROWSEとLIVEを利用できます。公開はプロフィール編集ページの公開設定で選べます。</p>
      <Link href="/my/cpp/home" className="mt-3 inline-block rounded-full bg-blue-700 px-5 py-2 font-bold text-white">CPPホームへ</Link>
    </> : !status.required_complete ? <>
      <p>次の必須事項を保存すると入室できます。別途の参加承認は必要ありません。</p>
      <p className="mt-2 font-semibold">未入力：{status.missing_fields.join("、")}</p>
      {editing ? <p className="mt-2 text-xs">保存済みの内容で判定しています。入力後、ページ上部の「今すぐ保存」または「CPPホームへ」で保存してください。</p> :
        <Link href={status.profile_exists ? "/my/cpp" : "/cpp/try"} className="mt-3 inline-block font-bold underline">研究者プロフィールを記入する</Link>}
    </> : <p>必須事項は保存済みです。利用状況により入室できないため、CPP運営にお問い合わせください。</p>}
  </section>;
}
