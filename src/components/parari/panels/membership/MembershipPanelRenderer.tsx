// apps/tools/parari/src/components/parari/panels/membership/MembershipPanelRenderer.tsx
// 2026-08-13 JST
// PART: MEMBERSHIP Panel public renderer
//
// コメント:
// - 未ログイン:
//     氏名 + メールアドレス
//     → join request作成
//     → Supabase magic link
//     → PARARIユーザー作成/ログイン
//
// - ログイン済み:
//     Auth emailを使用
//     → 氏名確認
//     → その場でMembership登録
//
// - PARARIユーザー登録自体を前面には出さない
// - ユーザーの主目的は「このMembershipの会員になること」

"use client";

import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { PanelRendererProps } from "../panelDefinitionTypes";
import type { MembershipPanelData } from "./membershipTypes";

type PublicRecruitment = {
  id: string;
  membership_id: string;
  membership_name: string;
  membership_description: string | null;
};

type PublicRecruitmentResponse = {
  ok?: boolean;
  recruitment?: PublicRecruitment;
  message?: string;
};

type JoinResponse = {
  ok?: boolean;
  requestId?: string;
  alreadyMember?: boolean;
  message?: string;
};

export default function MembershipPanelRenderer({
  data,
}: PanelRendererProps<MembershipPanelData>) {
  const recruitmentId = String(
    data.recruitmentId ?? "",
  ).trim();

  const [recruitment, setRecruitment] =
    React.useState<PublicRecruitment | null>(null);

  const [session, setSession] =
    React.useState<Session | null>(null);

  const [fullName, setFullName] =
    React.useState("");

  const [email, setEmail] =
    React.useState("");

  const [isLoading, setIsLoading] =
    React.useState(true);

  const [isSubmitting, setIsSubmitting] =
    React.useState(false);

  const [hasSentMail, setHasSentMail] =
    React.useState(false);

  const [completed, setCompleted] =
    React.useState(false);

  const [statusMessage, setStatusMessage] =
    React.useState("");

  /**
   * PART: Initial load
   *
   * - recruitment情報取得
   * - login状態確認
   * - login済みならprivate full_name取得
   */
  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!recruitmentId) {
        if (!cancelled) {
          setIsLoading(false);
          setStatusMessage(
            "会員登録先が設定されていません。",
          );
        }
        return;
      }

      setIsLoading(true);
      setStatusMessage("");

      try {
        /**
         * Auth状態確認
         */
        const {
          data: sessionData,
        } = await supabase.auth.getSession();

        if (cancelled) return;

        const currentSession =
          sessionData.session ?? null;

        setSession(currentSession);

        if (currentSession?.user) {
          const authEmail =
            currentSession.user.email ?? "";

          setEmail(authEmail);

          /**
           * private full_name
           */
          const {
            data: privateData,
          } = await supabase
            .from("user_private_profiles")
            .select("full_name")
            .eq(
              "user_id",
              currentSession.user.id,
            )
            .maybeSingle();

          if (cancelled) return;

          const privateRow = privateData as
            | {
                full_name?: string | null;
              }
            | null;

          if (privateRow?.full_name) {
            setFullName(
              String(
                privateRow.full_name,
              ).trim(),
            );
          }
        }

        /**
         * Public recruitment情報
         */
        const response = await fetch(
          `/api/membership/public?recruitmentId=${encodeURIComponent(
            recruitmentId,
          )}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | PublicRecruitmentResponse
            | null;

        if (cancelled) return;

        if (
          !response.ok ||
          !result?.ok ||
          !result.recruitment
        ) {
          setRecruitment(null);
          setStatusMessage(
            result?.message ||
              "会員登録情報を取得できませんでした。",
          );
          return;
        }

        setRecruitment(
          result.recruitment,
        );
      } catch (error) {
        console.error(
          "[MEMBERSHIP] load failed",
          error,
        );

        if (!cancelled) {
          setStatusMessage(
            "会員登録情報を取得できませんでした。",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [recruitmentId]);

  /**
   * PART: Membership join
   */
  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isSubmitting) return;

    const normalizedFullName =
      fullName.trim();

    const normalizedEmail =
      email.trim();

    if (!normalizedFullName) {
      setStatusMessage(
        "氏名を入力してください。",
      );
      return;
    }

    if (
      !session &&
      !normalizedEmail
    ) {
      setStatusMessage(
        "メールアドレスを入力してください。",
      );
      return;
    }

    if (!recruitmentId) {
      setStatusMessage(
        "会員登録先が設定されていません。",
      );
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("");

    try {
      /**
       * ログイン済み
       *
       * → Magic Link不要
       * → その場で membership_members に登録
       */
      if (session?.access_token) {
        const response = await fetch(
          "/api/membership/join",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              action: "join",
              recruitmentId,
              fullName:
                normalizedFullName,
            }),
          },
        );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | JoinResponse
            | null;

        if (
          !response.ok ||
          !result?.ok
        ) {
          setStatusMessage(
            result?.message ||
              "会員登録に失敗しました。",
          );
          return;
        }

        setCompleted(true);

        setStatusMessage(
          result.alreadyMember
            ? "すでに会員登録されています。"
            : "会員登録が完了しました。",
        );

        return;
      }

      /**
       * 未ログイン
       *
       * 1. membership_join_requests に仮保存
       * 2. requestId取得
       * 3. Magic Link送信
       */
      const prepareResponse =
        await fetch(
          "/api/membership/join",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "prepare",
              recruitmentId,
              fullName:
                normalizedFullName,
              email: normalizedEmail,
            }),
          },
        );

      const prepareResult =
        (await prepareResponse
          .json()
          .catch(() => null)) as
          | JoinResponse
          | null;

      if (
        !prepareResponse.ok ||
        !prepareResult?.ok ||
        !prepareResult.requestId
      ) {
        setStatusMessage(
          prepareResult?.message ||
            "会員登録の準備に失敗しました。",
        );
        return;
      }

      const returnTo =
        `/membership/join/complete?requestId=${encodeURIComponent(
          prepareResult.requestId,
        )}`;

      const {
        error: signInError,
      } =
        await supabase.auth.signInWithOtp(
          {
            email: normalizedEmail,
            options: {
              emailRedirectTo:
                `${window.location.origin}` +
                `/auth/callback?returnTo=${encodeURIComponent(
                  returnTo,
                )}`,
            },
          },
        );

      if (signInError) {
        setStatusMessage(
          "確認メールを送信できませんでした: " +
            signInError.message,
        );
        return;
      }

      setHasSentMail(true);

      setStatusMessage(
        "確認メールを送信しました。",
      );
    } catch (error) {
      console.error(
        "[MEMBERSHIP] join failed",
        error,
      );

      setStatusMessage(
        "会員登録処理中にエラーが発生しました。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Loading
   */
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="text-sm text-neutral-500">
          会員登録情報を読み込んでいます…
        </div>
      </div>
    );
  }

  /**
   * recruitment未取得
   */
  if (!recruitment) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
        <div className="text-sm font-semibold text-neutral-700">
          会員登録
        </div>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {statusMessage ||
            "現在この会員登録を利用できません。"}
        </p>
      </div>
    );
  }

  /**
   * 完了
   */
  if (completed) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="text-lg font-semibold text-emerald-900">
          {recruitment.membership_name}
        </div>

        <p className="mt-3 text-sm leading-6 text-emerald-800">
          {statusMessage ||
            "会員登録が完了しました。"}
        </p>
      </div>
    );
  }

  /**
   * Magic Link送信後
   */
  if (hasSentMail) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <div className="text-lg font-semibold text-neutral-900">
          メールをご確認ください
        </div>

        <p className="mt-3 text-sm leading-6 text-neutral-700">
          <span className="font-semibold">
            {email}
          </span>
          に確認メールを送信しました。
        </p>

        <p className="mt-2 text-sm leading-6 text-neutral-600">
          メール内のリンクを開くと、
          {recruitment.membership_name}
          への会員登録が完了します。
        </p>
      </div>
    );
  }

  const buttonLabel =
    `${recruitment.membership_name}に会員登録する`;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="text-center">
        <div className="text-xl font-bold text-neutral-950">
          {recruitment.membership_name}
        </div>

        {recruitment.membership_description ? (
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-600">
            {
              recruitment.membership_description
            }
          </p>
        ) : null}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto mt-6 max-w-md space-y-4"
      >
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-neutral-600">
            氏名
          </span>

          <input
            value={fullName}
            onChange={(event) =>
              setFullName(
                event.target.value,
              )
            }
            type="text"
            autoComplete="name"
            placeholder="氏名"
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-neutral-600">
            メールアドレス
          </span>

          <input
            value={email}
            onChange={(event) => {
              if (!session) {
                setEmail(
                  event.target.value,
                );
              }
            }}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            readOnly={Boolean(session)}
            className={[
              "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition",
              session
                ? "border-neutral-200 bg-neutral-50 text-neutral-500"
                : "border-neutral-200 bg-white focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100",
            ].join(" ")}
          />
        </label>

        {statusMessage ? (
          <p className="text-sm leading-6 text-red-600">
            {statusMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting
            ? "登録中…"
            : buttonLabel}
        </button>

        {!session ? (
          <p className="text-center text-xs leading-5 text-neutral-500">
            ※ 会員登録と同時に、
            PARARIの無料アカウントが作成されます。
          </p>
        ) : (
          <p className="text-center text-xs leading-5 text-neutral-400">
            PARARIにログイン済みです。
          </p>
        )}
      </form>
    </div>
  );
}
