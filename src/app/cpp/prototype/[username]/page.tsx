"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function CppPrototypeHomePage() {
  const params = useParams();
  const username = typeof params?.username === "string" ? params.username : "kanae-muraiso";

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold tracking-[0.2em] text-neutral-400">CPP</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">
              研究者プロフィール PROTOTYPE
            </h1>
            <p className="mt-2 text-sm text-neutral-500">@{username}</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
            保存・公開されません
          </span>
        </div>

        <div className="mt-8 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="max-w-2xl text-sm leading-7 text-neutral-600">
            CPP研究者プロフィールの画面設計を確認するためのモックです。入力画面と、企業から見たプロフィール画面を切り替えて確認できます。ここで入力・操作しても実際のデータには反映されません。
          </p>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <Link
              href={`/cpp/prototype/${username}/workbook`}
              className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6 transition hover:-translate-y-0.5 hover:border-neutral-400 hover:bg-white"
            >
              <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">RESEARCHER</div>
              <h2 className="mt-2 text-xl font-bold text-neutral-950">研究者が入力する画面</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-500">
                基本情報、研究分野、学歴・職歴、研究概要、論文、自己アピール、公開設定までの入力イメージです。
              </p>
              <div className="mt-5 text-sm font-bold text-neutral-900">入力画面を見る →</div>
            </Link>

            <Link
              href={`/cpp/prototype/${username}/company`}
              className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6 transition hover:-translate-y-0.5 hover:border-neutral-400 hover:bg-white"
            >
              <div className="text-xs font-bold tracking-[0.16em] text-neutral-400">COMPANY</div>
              <h2 className="mt-2 text-xl font-bold text-neutral-950">企業が見る画面</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-500">
                企業担当者が研究者を閲覧するときのプロフィール表示イメージです。候補保存・メッセージ等は見た目だけです。
              </p>
              <div className="mt-5 text-sm font-bold text-neutral-900">企業画面を見る →</div>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
