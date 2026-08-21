// src/components/parari/navigation/ManagementLinks.tsx
// 2026/08/20 JST
//
// PARARI 管理側への入口
//
// 表示ルール
// - 誰でも「設定」
// - 作品を持っている人 → 「作品」
// - FORM / APPLICATION / Membership を持つ人 → 「運営」
// - CALENDARを利用できる人 → 初回作成前でも「運営」

"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { supabase } from "@/lib/supabaseClient";


export default function ManagementLinks() {
  const [hasWorks, setHasWorks] =
    useState(false);

  const [
    hasOperations,
    setHasOperations,
  ] =
    useState(false);


  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!supabase) {
        return;
      }

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (
        !mounted ||
        !user
      ) {
        return;
      }


      /*
       * 作品の有無
       */

      const {
        count,
        error: worksError,
      } =
        await supabase
          .from("parari_books")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "owner",
            user.id,
          )
          .or(
            "is_deleted.is.null,is_deleted.eq.false",
          );

      if (
        mounted &&
        !worksError
      ) {
        setHasWorks(
          (count ?? 0) > 0,
        );
      }


      /*
       * 運営
       */

      const {
        data: sessionData,
      } =
        await supabase.auth.getSession();

      const accessToken =
        sessionData.session
          ?.access_token ?? "";

      if (!accessToken) {
        return;
      }

      const headers = {
        Authorization:
          `Bearer ${accessToken}`,
      };


      try {
        const [
          formResponse,
          applicationResponse,
          membershipResponse,
          calendarResponse,
        ] =
          await Promise.all([
            fetch(
              "/api/form/manage",
              {
                method: "GET",
                headers,
                cache: "no-store",
              },
            ),

            fetch(
              "/api/application/manage",
              {
                method: "GET",
                headers,
                cache: "no-store",
              },
            ),

            fetch(
              "/api/membership/manage",
              {
                method: "GET",
                headers,
                cache: "no-store",
              },
            ),

            fetch(
              "/api/calendar/items",
              {
                method: "GET",
                headers,
                cache: "no-store",
              },
            ),
          ]);


        const [
          formResult,
          applicationResult,
          membershipResult,
        ] =
          await Promise.all([
            formResponse
              .json()
              .catch(() => null),

            applicationResponse
              .json()
              .catch(() => null),

            membershipResponse
              .json()
              .catch(() => null),
          ]);


        if (!mounted) {
          return;
        }


        const hasForms =
          formResponse.ok &&
          Array.isArray(
            formResult?.forms,
          ) &&
          formResult.forms.length > 0;


        const hasApplications =
          applicationResponse.ok &&
          Array.isArray(
            applicationResult
              ?.applications,
          ) &&
          applicationResult
            .applications.length > 0;


        const hasMemberships =
          membershipResponse.ok &&
          Array.isArray(
            membershipResult
              ?.memberships,
          ) &&
          membershipResult
            .memberships.length > 0;


        /*
         * CALENDARは初回作成前にも
         * 運営への入口が必要。
         *
         * 現時点ではAPIを正常に利用できれば
         * CALENDAR運営可能とみなす。
         */
        const canUseCalendar =
          calendarResponse.ok;


        setHasOperations(
          hasForms ||
            hasApplications ||
            hasMemberships ||
            canUseCalendar,
        );
      } catch (error) {
        console.error(
          "load management navigation state failed:",
          error,
        );
      }
    }


    void load();


    return () => {
      mounted = false;
    };
  }, []);


  return (
    <div className="flex items-center gap-4">
      {hasWorks ? (
        <Link
          href="/my/works"
          className="text-xs font-bold text-neutral-500 transition hover:text-neutral-950"
        >
          作品
        </Link>
      ) : null}


      {hasOperations ? (
        <Link
          href="/my/manage"
          className="text-xs font-bold text-neutral-500 transition hover:text-neutral-950"
        >
          運営
        </Link>
      ) : null}


      <Link
        href="/my/profile"
        className="text-xs font-bold text-neutral-500 transition hover:text-neutral-950"
      >
        設定
      </Link>
    </div>
  );
}
