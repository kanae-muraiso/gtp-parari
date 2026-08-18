// src/app/my/manage/page.tsx
// 2026/08/18 JST
//
// PARARI 運営
//
// FORM / APPLICATION / Membership の
// 管理機能を集約する場所。
// 現在は既存管理画面への入口。
// 次工程から順番に本体を移設する。

"use client";

import { useState } from "react";
import Link from "next/link";

import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import ParariTabs from "@/components/parari/navigation/ParariTabs";

type ManageMode =
  | "form"
  | "application"
  | "membership";

const MANAGE_TABS = [
  {
    key: "form",
    label: "FORM",
  },
  {
    key: "application",
    label: "APPLICATION",
  },
  {
    key: "membership",
    label: "Membership",
  },
];

export default function MyManagePage() {
  const [
    manageMode,
    setManageMode,
  ] = useState<ManageMode>("form");

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* HEADER */}
        <MyAreaHeader title="運営" />

        {/* MANAGE TABS */}
        <div className="mt-6">
          <ParariTabs
            items={MANAGE_TABS}
            active={manageMode}
            onChange={(key) =>
              setManageMode(
                key as ManageMode,
              )
            }
          />
        </div>

        {/* CONTENT */}
        <div className="mt-8">
          {manageMode === "form" ? (
            <ManagePlaceholder
              title="FORM"
              description="申込みやアンケートなどで使用する入力フォームを管理します。"
              href="/my/profile?tab=plus"
            />
          ) : null}

          {manageMode ===
          "application" ? (
            <ManagePlaceholder
              title="APPLICATION"
              description="参加・応募・申込みの受付を管理します。"
              href="/my/profile?tab=plus"
            />
          ) : null}

          {manageMode ===
          "membership" ? (
            <ManagePlaceholder
              title="Membership"
              description="Membershipの開設、会員、メンバー限定作品を管理します。"
              href="/my/profile?tab=host"
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}

function ManagePlaceholder({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="text-xs font-bold tracking-[0.14em] text-neutral-400">
        MANAGEMENT
      </div>

      <h2 className="mt-3 text-xl font-bold text-neutral-950">
        {title}
      </h2>

      <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">
        {description}
      </p>

      <div className="mt-6">
        <Link
          href={href}
          className="inline-flex rounded-full bg-neutral-950 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-neutral-700"
        >
          現在の管理画面を開く
        </Link>
      </div>

      <p className="mt-4 text-xs leading-6 text-neutral-400">
        この管理機能は順次「運営」へ移行します。
      </p>
    </section>
  );
}
