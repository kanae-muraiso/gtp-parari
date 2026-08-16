// apps/tools/parari/src/components/parari/ProfileRowPanel.tsx
// apps/tools/parari/src/components/parari/ProfileRowPanel.tsx
// 2026-06-08 JST

"use client";

/**
 * PART: ProfileRowPanel
 * コメント:
 * - My Works 先頭に置くホームページ導線
 * - 編集 / ビュー導線
 * - username / user_id の整合性警告を表示する
 */

import Link from "next/link";

type Props = {
  username: string | null;
  currentUserId?: string | null;
  profileUserId?: string | null;
  usernameOwnerUserId?: string | null;
};

export default function ProfileRowPanel({
  username,
  currentUserId,
  profileUserId,
  usernameOwnerUserId,
}: Props) {
  const normalizedUsername = String(username ?? "").trim();
  const viewHref = normalizedUsername ? `/${normalizedUsername}` : "/my/profile";

  const hasNoUsername = !normalizedUsername;

  const hasProfileMismatch =
    Boolean(currentUserId && profileUserId && currentUserId !== profileUserId);

  const hasUsernameOwnerMismatch =
    Boolean(
      currentUserId &&
        usernameOwnerUserId &&
        currentUserId !== usernameOwnerUserId,
    );

  const hasWarning =
    hasNoUsername || hasProfileMismatch || hasUsernameOwnerMismatch;

  const warningText = hasNoUsername
    ? "ホームページURLがまだ設定されていません。"
    : hasProfileMismatch
      ? "ログイン中の会員IDとプロフィール所有者が一致していません。"
      : hasUsernameOwnerMismatch
        ? "このユーザーネームは別の会員IDに紐づいています。"
        : "";

  return (
    <div
      className={[
        "mb-4 rounded-lg border px-4 py-3",
        hasWarning ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        {/* 左：タイトル */}
        <div>
          <div className="text-sm font-semibold">ホームページ作成</div>

          <div className="mt-1 text-xs text-neutral-500">
            {normalizedUsername
              ? `公開URL: /${normalizedUsername}`
              : "公開URLは未設定です"}
          </div>
        </div>

        {/* 右：ボタン */}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/my/profile"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
          >
            編集
          </Link>

          {hasWarning ? (
            <button
              type="button"
              className="cursor-not-allowed rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm opacity-40"
              disabled
            >
              ビュー
            </button>
          ) : (
            <Link
              href={viewHref}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm hover:bg-neutral-100"
            >
              ビュー
            </Link>
          )}
        </div>
      </div>

      {hasWarning ? (
        <div className="mt-3 rounded-md border border-red-200 bg-white px-3 py-2 text-xs leading-5 text-red-700">
          {warningText}
          <div className="mt-2 font-mono text-[11px] text-red-500">
            current: {currentUserId || "未取得"} / profile:{" "}
            {profileUserId || "未取得"} / username owner:{" "}
            {usernameOwnerUserId || "未取得"}
          </div>
        </div>
      ) : null}
    </div>
  );
}
