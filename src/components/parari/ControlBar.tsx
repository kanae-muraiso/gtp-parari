// apps/tools/parari/src/components/parari/ControlBar.tsx
// apps/tools/parari/src/components/parari/ControlBar.tsx
// 2026-04-13 JST

"use client";

/**
 * PART: ControlBar
 * コメント:
 * - ControlBar を「2段構造」の表示装置として扱う
 * - 1段目 = 現在地 / 世界の切替 / パンくず
 * - 2段目 = 戻る / 各種アクション
 * - title は1段目左側の既定表示として使う
 * - leftSlot / rightSlot は2段目の既定差し込み口として残す
 * - headline / actionLeft / actionRight を渡せば、より明示的に使える
 * - ControlBar 自身はプロフィール設定や logout を常設しない
 * - 「押せるもの」は共通部品で見た目をそろえる
 */

import Link from "next/link";
import React from "react";
import { usePathname } from "next/navigation";

type ControlBarTone = "dark" | "light";

type Props = {
  /**
   * PART: first row
   * コメント:
   * - 1段目左側の既定テキスト
   * - 例:
   *   "マイ本棚 / 表示設定"
   *   "マイ作品 / プロフィール設定"
   */
  title?: string;

  /**
   * PART: explicit row slots
   * コメント:
   * - より自由に使いたい場合はこちらを使う
   */
  headline?: React.ReactNode;
  headlineRight?: React.ReactNode;
  actionLeft?: React.ReactNode;
  actionRight?: React.ReactNode;

  /**
   * PART: legacy / convenience props
   * コメント:
   * - 既存ページとの互換のため残す
   * - backHref があれば2段目左に「戻る」を出す
   * - leftSlot / rightSlot は2段目に差し込む
   */
  backHref?: string;
  backLabel?: string;
  onBackClick?: () => void;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;

  /**
   * PART: appearance
   * コメント:
   * - barClassName で背景や文字色を切り替える
   * - dark / light で押せるものの見た目をそろえる
   */
  barClassName?: string;
  containerClassName?: string;
  tone?: ControlBarTone;
    
    showDefaultNav?: boolean;
    
};

function hasParariUnsavedChanges() {
  if (typeof document === "undefined") return false;
  return document.body.dataset.parariDirty === "1";
}

function confirmLeaveIfDirty() {
  /**
   * PART: unsaved guard
   * コメント:
   * - 現段階では常に true
   * - 将来ここに confirm を戻せる
   */
  const _dirty = hasParariUnsavedChanges();
  return true;
}

function joinClassNames(...values: Array<string | undefined | null | false>) {
  return values.filter(Boolean).join(" ");
}

/**
 * PART: shared action class
 * コメント:
 * - ControlBar 内の「押せるもの」を共通見た目にする
 * - tone によって dark / light を切り替える
 */
export function getControlBarActionClass(
  tone: ControlBarTone = "dark",
  muted = false,
  className?: string
) {
  const base =
    "inline-flex items-center justify-center rounded-lg border px-3 py-1 text-sm transition-colors";
  const toneClass =
    tone === "dark"
      ? muted
        ? "border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
        : "border-white/20 text-white hover:bg-white/10"
      : muted
      ? "border-black/10 bg-white/70 text-black/70 hover:bg-white hover:text-black"
      : "border-black/10 bg-white/70 text-black hover:bg-white";

  return joinClassNames(base, toneClass, className);
}

/**
 * PART: shared link button
 * コメント:
 * - Link でも button でも見た目をそろえるための共通部品
 */
export function ControlBarLinkButton({
  href,
  children,
  tone = "dark",
  muted = false,
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  tone?: ControlBarTone;
  muted?: boolean;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={getControlBarActionClass(tone, muted, className)}
      >
        {children}
      </Link>
    );
}

/**
 * PART: shared button
 * コメント:
 * - 押せる見た目を Link とそろえる
 */
export function ControlBarButton({
  children,
  onClick,
  tone = "dark",
  muted = false,
  className,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  tone?: ControlBarTone;
  muted?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={getControlBarActionClass(tone, muted, className)}
    >
      {children}
    </button>
  );
}

export default function ControlBar({
  title,
  headline,
  headlineRight,
  actionLeft,
  actionRight,
  backHref,
  backLabel = "← 戻る",
  onBackClick,
  leftSlot,
  rightSlot,
  barClassName = "bg-black text-white",
  containerClassName,
  tone = "dark",
  showDefaultNav = true,
}: Props) {
  /**
   * PART: first row
   * コメント:
   * - headline があればそれを優先
   * - なければ title を既定表示する
   */
    const pathname = usePathname();

    const navItem = (href: string, label: string) => {
      const active = pathname === href;

      return (
              <Link
                href={href}
                onClick={(e) => {
                  const dirty = hasParariUnsavedChanges();

                  if (!dirty) return;

                  e.preventDefault();

                  window.dispatchEvent(
                    new CustomEvent("parari:request-save-and-leave", {
                      detail: { href },
                    }),
                  );
                }}
                className={
            "px-3 py-1 rounded-lg border text-sm font-semibold transition-colors " +
              (active
                ? tone === "dark"
                  ? "bg-white text-black border-white"
                  : "bg-black text-white border-black"
                : tone === "dark"
                  ? "text-white border-white/40"
                  : "text-black border-black/20")
          }
        >
          {label}
        </Link>
      );
    };

    const defaultHeadline = (
      <div className="flex items-center gap-3">
        {navItem("/mypage", "本棚")}

        {navItem("/my/works", "作品")}
      </div>
    );

    const resolvedHeadline =
      headline ??
      (showDefaultNav ? (
        defaultHeadline
      ) : title ? (
        <div className="text-sm font-semibold">{title}</div>
      ) : null);
    
  /**
   * PART: second row left
   * コメント:
   * - actionLeft があればそれを優先
   * - なければ backHref / leftSlot を既定表示
   */
  const resolvedActionLeft =
    actionLeft ?? (
      <div className="flex flex-wrap items-center gap-2">
                   {onBackClick ? (
                     <ControlBarButton
                       tone={tone}
                       onClick={onBackClick}
                     >
                       {backLabel}
                     </ControlBarButton>
                   ) : backHref ? (
                     <ControlBarLinkButton
                       href={backHref}
                       tone={tone}
                       onClick={(e) => {
                         const ok = confirmLeaveIfDirty();
                         if (!ok) e.preventDefault();
                       }}
                     >
                       {backLabel}
                     </ControlBarLinkButton>
                   ) : null}

        {leftSlot ? <div className="flex flex-wrap items-center gap-2">{leftSlot}</div> : null}
      </div>
    );

  /**
   * PART: second row right
   * コメント:
   * - actionRight があればそれを優先
   * - なければ rightSlot を既定表示
   */
  const resolvedActionRight =
    actionRight ?? (rightSlot ? <div className="flex flex-wrap items-center gap-2">{rightSlot}</div> : null);

  const hasFirstRow = Boolean(resolvedHeadline || headlineRight);
  const hasSecondRow = Boolean(
    resolvedActionLeft ||
      resolvedActionRight ||
      backHref ||
      leftSlot ||
      rightSlot ||
      actionLeft ||
      actionRight
  );

  return (
    <div className={joinClassNames("sticky top-0 z-50 border-b", barClassName)}>
      <div
        className={joinClassNames(
          "mx-auto flex max-w-5xl flex-col gap-2 px-3 py-2",
          containerClassName
        )}
      >
        {hasFirstRow ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">{resolvedHeadline}</div>
            {headlineRight ? <div className="flex flex-wrap items-center gap-2">{headlineRight}</div> : null}
          </div>
        ) : null}

        {hasSecondRow ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">{resolvedActionLeft}</div>
            {resolvedActionRight ? <div className="flex flex-wrap items-center gap-2">{resolvedActionRight}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
