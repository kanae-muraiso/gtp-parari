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

import FormManagerPanel from "@/components/parari/manage/FormManagerPanel";
import ApplicationManager from "@/components/parari/settings/ApplicationManager";
import CalendarManagerPanel from "@/components/parari/manage/CalendarManagerPanel";
import MembershipManagerPanel from "@/components/parari/manage/MembershipManagerPanel";
import {
  getEffectivePlan,
  getPlanEntitlements,
  type PlanEntitlements,
} from "@/lib/billing/plan";
import { supabase } from "@/lib/supabaseClient";


type ManageMode =
  | "form"
  | "application"
  | "calendar"
  | "membership";


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

  const manageTabs = useMemo(() => {
    const tabs: {
      key: ManageMode;
      label: string;
    }[] = [];

    if (entitlements.canManageForms) {
      tabs.push({
        key: "form",
        label: "FORM",
      });
    }

    tabs.push({
      key: "application",
      label: "APPLICATION",
    });

    if (entitlements.canManageCalendar) {
      tabs.push({
        key: "calendar",
        label: "CALENDAR",
      });
    }

    if (entitlements.canManageMembership) {
      tabs.push({
        key: "membership",
        label: "Membership",
      });
    }

    return tabs;
  }, [entitlements]);

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

      const [billingResult, profileResult] =
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
        ]);

      if (cancelled) return;

      const effectivePlan =
        getEffectivePlan(
          billingResult.data,
        );

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
      tab === "form" ||
      tab === "application" ||
      tab === "calendar" ||
      tab === "membership"
    ) {
      setManageMode(
        tab,
      );
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
    <main className="min-h-screen bg-amber-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">

        <MyAreaHeader
          title="運営"
          showManagementLinks={false}
        />

        <div className="mt-6">
          <ManagementTabs active="manage" />
        </div>

        <div className="mt-4">
          <ParariTabs
            items={manageTabs}
            active={manageMode}
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

          {accessLoaded &&
          manageMode === "form" ? (
            <FormManagerPanel />
          ) : null}

          {accessLoaded &&
          manageMode === "application" ? (
            <ApplicationManager />
          ) : null}

          {accessLoaded &&
          manageMode === "calendar" ? (
            <CalendarManagerPanel />
          ) : null}

          {accessLoaded &&
          manageMode === "membership" ? (
            <MembershipManagerPanel />
          ) : null}
        </div>
      </div>
    </main>
  );
}
