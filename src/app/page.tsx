// src/app/page.tsx
// 2026/09/15 JST

"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useParticipations } from "@/components/parari/navigation/ParticipationProvider";
import { classRequest } from "@/lib/classRequests";

export default function HomePage() {
  const router = useRouter();
  const { userId, items, loading, error, refresh, navigate } = useParticipations();
  const [checkedOwner, setCheckedOwner] = React.useState<{ userId: string; school: { name: string } | null } | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    void classRequest<{ userId: string; owned: { name: string } | null }>("?home=1", undefined, controller.signal)
      .then(result => {
        if (!controller.signal.aborted) setCheckedOwner({ userId: result.userId, school: result.owned });
      })
      .catch(() => {
        if (!controller.signal.aborted) setCheckedOwner({ userId, school: null });
      });
    return () => controller.abort();
  }, [userId]);

  const ownership = checkedOwner?.userId === userId ? checkedOwner : null;
  React.useEffect(() => {
    if (userId && !loading && !error && ownership && !ownership.school && items.length === 0) {
      router.replace("/mypage");
    }
  }, [userId, loading, error, ownership, items.length, router]);

  if (loading || (userId && !ownership)) {
    return <main className="min-h-screen bg-white px-6 py-12 text-sm" role="status">行き先を確認しています…</main>;
  }

  if (userId) {
    if (!error && !ownership?.school && items.length === 0) return null;
    return (
      <main className="min-h-screen bg-[#f7f4ee] px-6 py-12 text-neutral-900">
        <section className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-bold">行き先を選ぶ</h1>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Destination href="/mypage" name="PARARI" />
            {ownership?.school && <Destination href="/my/manage?tab=class" name={ownership.school.name} detail="教室を運営" />}
            {items.map(item => <Destination key={item.key} href={item.href} name={item.name}
              detail={item.state === "active" ? undefined : item.action}
              onClick={event => {
                if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
                event.preventDefault();
                void navigate(item.key);
              }} />)}
          </div>
          {error && <p role="alert" className="mt-4 text-sm">{error} <button onClick={refresh} className="underline">再読み込み</button></p>}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-neutral-900">
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm tracking-[0.28em] text-neutral-500">
          PARARI
        </p>

        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          PARARI（パラリ）
        </h1>

        <p className="mt-6 text-lg leading-8 text-neutral-700">
          写真と文章でページを作り、束ねて1冊の本にできる
          デジタル・コミュニケーションツールです。
        </p>

        <p className="mt-4 text-base leading-8 text-neutral-600">
          ぱらりと読めて、きちんと届く。SNSでは流れてしまう想いや案内を、
          ひとつのURLにまとめて届けられます。
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
          >
            ログイン・登録
          </Link>

          <Link
            href="/packages"
            className="rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-800"
          >
            パッケージを見る
          </Link>
          <Link
            href="https://parari.cpp.co.jp/"
            className="rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-800"
          >
            パラリとは？
          </Link>
        </div>
      </section>
    </main>
  );
}

function Destination({ href, name, detail, onClick }: {
  href: string;
  name: string;
  detail?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link href={href} onClick={onClick} className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-500 focus-visible:outline focus-visible:outline-2">
      <span aria-hidden="true" className="mb-3 grid size-10 place-items-center rounded-xl bg-neutral-900 font-bold text-white">{Array.from(name)[0]}</span>
      <span className="block break-words text-sm font-bold">{name}</span>
      {detail && <span className="mt-1 block text-xs text-neutral-600">{detail}</span>}
    </Link>
  );
}
