// src/components/parari/viewer/viewerWidthRules.ts
// 2026-07-01 JST
// PART: PARARI viewer width rules
// コメント:
// - Viewerのキャンバス幅・文字列幅・画像幅を一元管理する
// - PAGE画像 / 本文IMAGE画像 / 旧FIGURE画像で同じ幅ルールを使う
// - 画像Renderer側で個別に w-screen / max-w-[100vw] を使わない
// - SSOT保存形式は変更せず、既存値をここで正規化する

export type ParariViewerImageWidth =
  | "max"
  | "canvas"
  | "text"
  | "normal";

/**
 * Viewerキャンバス
 *
 * スマホ: 最大440px
 * PC: 最大720px
 */
export const PARARI_VIEWER_CANVAS_CLASS =
  "mx-auto w-[calc(100vw-16px)] max-w-[720px] sm:w-[calc(100vw-32px)]";

/**
 * Viewerカード
 *
 * 横paddingで本文幅を決めない。
 * 文字列幅は PARARI_VIEWER_TEXT_WIDTH_CLASS で決める。
 */
export const PARARI_VIEWER_CARD_CLASS =
  "rounded-[28px] bg-white py-6 pb-36 shadow-sm md:py-10 md:pb-36";

/**
 * 通常本文幅
 *
 * キャンバス幅の90%
 */
export const PARARI_VIEWER_TEXT_WIDTH_CLASS = "mx-auto w-[90%]";

/**
 * パネル内テキストなどを通常本文幅に合わせたい場合に使う。
 * 現時点では通常本文と同じ。
 */
export const PARARI_VIEWER_CONTENT_WIDTH_CLASS =
  PARARI_VIEWER_TEXT_WIDTH_CLASS;

/**
 * 既存SSOT / 既存UIの幅値を、新しいViewer内部値へ正規化する。
 *
 * 内部値:
 * - max    : 全幅。最大720px
 * - canvas : キャンバス幅100%
 * - text   : キャンバス幅90%。文字列幅と同じ
 * - normal : 通常画像。キャンバス幅75%
 */
export function normalizeViewerImageWidth(
  value: unknown,
  fallback: ParariViewerImageWidth = "normal",
): ParariViewerImageWidth {
  const text = String(value ?? "").trim().toLowerCase();

  /**
   * 全幅
   *
   * 既存の full / bleed は max として読む。
   */
  if (text === "max" || text === "full" || text === "bleed") {
    return "max";
  }

  /**
   * キャンバス100%
   */
  if (
    text === "100" ||
    text === "100%" ||
    text === "canvas" ||
    text === "container"
  ) {
    return "canvas";
  }

  /**
   * 文字列幅 = キャンバス90%
   *
   * 既存の wide / standard は text として扱う。
   */
  if (
    text === "90" ||
    text === "90%" ||
    text === "text" ||
    text === "body" ||
    text === "wide" ||
    text === "standard"
  ) {
    return "text";
  }

  /**
   * 通常画像
   */
  if (
    text === "normal" ||
    text === "default" ||
    text === "small" ||
    text === "narrow" ||
    text === "70" ||
    text === "70%" ||
    text === "75" ||
    text === "75%" ||
    text === "80" ||
    text === "80%"
  ) {
    return "normal";
  }

  return fallback;
}

/**
 * 画像幅classを返す。
 *
 * 前提:
 * - 親のViewerキャンバスが max 440px / md:max 720px を持つ
 * - この関数はPAGE画像・本文画像の両方から使う
 */
export function viewerImageWidthClass(
  value: unknown,
  fallback: ParariViewerImageWidth = "normal",
): string {
  const width = normalizeViewerImageWidth(value, fallback);

  switch (width) {
      case "max":
        return "relative left-1/2 w-[calc(100vw-16px)] max-w-[720px] -translate-x-1/2 sm:w-[calc(100vw-32px)]";

    case "canvas":
      /**
       * 100%:
       * - 現在のPARARIキャンバス幅いっぱい
       */
      return "mx-auto w-full";

    case "text":
      /**
       * 90%:
       * - 通常本文と同じ幅
       */
      return "mx-auto w-[90%]";

    case "normal":
    default:
      /**
       * 通常画像:
       * - キャンバス幅の75%
       */
      return "mx-auto w-[75%] max-w-full";
  }
}
