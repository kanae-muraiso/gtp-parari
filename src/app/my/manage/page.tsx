// src/app/my/manage/page.tsx
// src/app/my/manage/page.tsx
// 2026/08/18 JST
//
// PARARI 運営
//
// 管理メインメニュー
//   作品 / 運営 / 設定
//
// 運営サブメニュー
//   FORM / APPLICATION / Membership

"use client";

import { useState } from "react";

import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import ManagementTabs from "@/components/parari/navigation/ManagementTabs";
import ParariTabs from "@/components/parari/navigation/ParariTabs";
import FormManagerPanel from "@/components/parari/manage/FormManagerPanel";
import ApplicationManager from "@/components/parari/settings/ApplicationManager";
import MembershipManagerPanel from "@/components/parari/manage/MembershipManagerPanel";

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
        <MyAreaHeader
          title="運営"
          showManagementLinks={false}
        />

        {/* MANAGEMENT MAIN MENU */}
        <div className="mt-6">
          <ManagementTabs active="manage" />
        </div>

          {/* MANAGEMENT SUB MENU */}
          <div className="mt-4">
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

          {/* PLAN GUIDE */}
          <div className="mt-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-xs leading-6 text-neutral-500 shadow-sm">
            <span className="font-bold text-neutral-700">
              必要なプラン：
            </span>
            FORM・APPLICATIONは
            <span className="mx-1 font-bold text-neutral-900">
              PLUS
            </span>
            、Membershipは
            <span className="mx-1 font-bold text-neutral-900">
              HOST
            </span>
            で利用できます。
          </div>

          {/* CONTENT */}
          <div className="mt-8">
          {manageMode === "form" ? (
            <FormManagerPanel />
          ) : null}

          {manageMode === "application" ? (
            <ApplicationManager />
          ) : null}

          {manageMode === "membership" ? (
            <MembershipManagerPanel />
          ) : null}
        </div>
      </div>
    </main>
  );
}
