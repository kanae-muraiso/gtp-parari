// src/app/my/manage/page.tsx
// 2026/08/20 JST
//
// PARARI 運営
//
// 管理メインメニュー
//   作品 / 運営 / 設定
//
// 運営サブメニュー
//   FORM / APPLICATION / CALENDAR / Membership

"use client";

import { useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import ManagementTabs from "@/components/parari/navigation/ManagementTabs";
import ParariTabs from "@/components/parari/navigation/ParariTabs";

import ApplicationManager from "@/components/parari/settings/ApplicationManager";
import CalendarManagerPanel from "@/components/parari/manage/CalendarManagerPanel";
import ClassManagerPanel from "@/components/parari/manage/ClassManagerPanel";
import MembershipManagerPanel from "@/components/parari/manage/MembershipManagerPanel";
import {
  getEffectivePlan,
  getPlanEntitlements,
  type PlanEntitlements,
} from "@/lib/billing/plan";
import { supabase } from "@/lib/supabaseClient";
import { classRequest } from "@/lib/classRequests";


type ManageMode =
  | "application"
  | "recruit"
  | "service"
  | "custom"
  | "calendar";


export default function MyManagePage() {
  const router =
    useRouter();

  const [
    manageMode,
    setManageMode,
  ] = useState<ManageMode>("application");

  const [
    entitlements,
    setEntitlements,
  ] = useState<PlanEntitlements>(
    getPlanEntitlements("free"),
  );
  const [
    accessLoaded,
    setAccessLoaded,
  ] = useState(false);

  const [isMonitor, setIsMonitor] = useState(false);
  const [canManageClass, setCanManageClass] = useState(false);

  const manageTabs = useMemo(() => {
    const tabs: {
      key: ManageMode;
      label: string;
    }[] = [
      { key: "application", label: "申込受付" },
      { key: "recruit", label: "募集をつくる" },
    ];

    if (isMonitor || entitlements.canManageMembership || canManageClass) {
      const label = canManageClass
        ? entitlements.canManageMembership ? "クラス・継続運営" : "クラス運営"
        : "継続運営";
      tabs.push({ key: "service", label });
    }

    tabs.push({ key: "custom", label: "カスタム設計" });

    // 開催予定は運営メニューの最後に置く。
    if (entitlements.canManageCalendar) {
      tabs.push({ key: "calendar", label: "開催予定" });
    }

    return tabs;
  }, [entitlements, isMonitor, canManageClass]);

  useEffect(() => {
    let cancelled = false;

    async function loadEntitlements() {
      if (!supabase) {
        setAccessLoaded(true);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        if (!cancelled) {
          setAccessLoaded(true);
        }
        return;
      }

      const [billingResult, profileResult, classAccess] =
        await Promise.all([
          supabase
            .from("user_billing")
            .select("plan, billing_status")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("is_monitor")
            .eq("user_id", user.id)
            .maybeSingle(),
          classRequest<{ canManage: boolean }>("?home=1")
            .then((result) => result.canManage === true)
            .catch(() => false),
        ]);

      if (cancelled) return;

      const effectivePlan =
        getEffectivePlan(
          billingResult.data,
        );

      setIsMonitor(profileResult.data?.is_monitor === true);
      setCanManageClass(classAccess);
      setEntitlements(
        getPlanEntitlements(
          effectivePlan,
          profileResult.data
            ?.is_monitor === true,
        ),
      );
      setAccessLoaded(true);
    }

    void loadEntitlements();

    return () => {
      cancelled = true;
    };
  }, []);


  /*
   * URLから現在の運営タブを復元する。
   *
   * /my/manage?tab=calendar
   * の状態で戻ってきた場合、
   * CALENDARを再表示する。
   */
  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search,
      );

    const tab =
      params.get("tab");

    if (
      tab === "application" ||
      tab === "recruit" ||
      tab === "service" ||
      tab === "custom" ||
      tab === "calendar"
    ) {
      setManageMode(tab);
    } else if (tab === "form") {
      // Keep older FORM links working while hiding the technical menu item.
      setManageMode("recruit");
    } else if (tab === "membership" || tab === "class") {
      setManageMode("service");
    }
  }, []);

  useEffect(() => {
    if (!accessLoaded) return;

    const isVisible =
      manageTabs.some(
        (tab) => tab.key === manageMode,
      );

    if (!isVisible) {
      setManageMode("application");
      router.replace(
        "/my/manage?tab=application",
        { scroll: false },
      );
    }
  }, [
    accessLoaded,
    manageMode,
    manageTabs,
    router,
  ]);


  function changeManageMode(
    nextMode: ManageMode,
  ) {
    setManageMode(
      nextMode,
    );

    /*
     * タブ切替自体は履歴を増やさない。
     * ただし現在地をURLには残す。
     */
    router.replace(
      `/my/manage?tab=${nextMode}`,
      {
        scroll: false,
      },
    );
  }


  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="mx-auto w-full max-w-[768px] px-4 py-6 sm:px-6 sm:py-8">

        <MyAreaHeader
          title={manageMode === "application" ? "申込受付" : manageMode === "recruit" ? "募集をつくる" : manageMode === "service" ? canManageClass ? entitlements.canManageMembership ? "クラス・継続運営" : "クラス運営" : "継続運営" : manageMode === "custom" ? "カスタム設計" : "開催予定"}
          area="studio"
          navigation={<ManagementTabs active="manage" embedded />}
        />

        <div className="mt-4">
          <ParariTabs
            items={manageTabs}
            active={manageMode}
            color="studio"
            onChange={(key) =>
              changeManageMode(
                key as ManageMode,
              )
            }
          />
        </div>

        <div className="mt-8">
          {!accessLoaded ? (
            <p className="text-sm text-neutral-400">
              利用できる機能を確認しています…
            </p>
          ) : null}

          {accessLoaded && manageMode === "application" ? (
            <>
              <section className="mb-5 rounded-2xl border border-neutral-200 bg-white p-5">
                <h2 className="text-lg font-bold text-neutral-950">募集作品への申込</h2>
                <p className="mt-1 text-sm leading-6 text-neutral-600">
                  あなたの募集に届いた申込を確認し、申込者への対応を行います。
                </p>
              </section>
              <ApplicationManager />
              {entitlements.canManageCalendar ? (
                <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
                  <h2 className="text-lg font-bold text-neutral-950">事業の開催予定</h2>
                  <p className="mt-1 text-sm leading-6 text-neutral-600">
                    登録したクラスやイベントのスケジュールを確認・管理します。
                  </p>
                  <button
                    type="button"
                    onClick={() => changeManageMode("calendar")}
                    className="mt-3 rounded-full border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                  >
                    開催予定を開く
                  </button>
                </section>
              ) : null}
            </>
          ) : null}

          {accessLoaded && manageMode === "recruit" ? (
            <ApplicationManager createOnly />
          ) : null}

          {accessLoaded && manageMode === "service" ? (
            <div className="grid gap-5">
              {canManageClass || isMonitor ? <ClassManagerPanel /> : null}
              {entitlements.canManageMembership ? <MembershipManagerPanel /> : null}
            </div>
          ) : null}

          {accessLoaded && manageMode === "custom" ? (
            <section className="rounded-3xl border border-violet-200 bg-violet-50 p-5 sm:p-6">
              <div className="text-xs font-bold tracking-[0.16em] text-violet-700">CUSTOM DESIGN</div>
              <h2 className="mt-2 text-lg font-bold text-neutral-950">カスタム設計</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-700">
                事業の流れに合わせて、申込・参加者管理・開催予定を組み立てる機能を準備しています。
              </p>
              <span className="mt-4 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-bold text-violet-800 ring-1 ring-violet-200">
                準備中
              </span>
            </section>
          ) : null}

          {accessLoaded && manageMode === "calendar" ? (
            <CalendarManagerPanel />
          ) : null}
        </div>
      </div>
    </main>
  );
}
