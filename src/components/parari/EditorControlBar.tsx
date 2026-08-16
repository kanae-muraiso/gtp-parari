// apps/tools/parari/src/components/parari/EditorControlBar.tsx
// apps/tools/parari/src/components/parari/EditorControlBar.tsx
// 2026/06/10 16:29 JST


"use client";

/**
 * PART: EditorControlBar
 * コメント:
 * - 右側世界（作品作成環境）専用の中身組み立て役
 * - バー本体は ControlBar に任せる
 * - 1段目: 世界の切替 / 現在地
 * - 2段目: 戻る / 新規作成 / プロフィール設定 など
 */

import React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import ControlBar, {
  ControlBarButton,
  ControlBarLinkButton,
} from "./ControlBar";

type Props =
  | {
      current: "works";
      onCreatePage?: () => void;
      onCreateBook?: () => void;
    }
  | {
      current: "profile";
      returnTo?: string;
    };

export default function EditorControlBar(props: Props) {
  const router = useRouter();

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/");
  }

  /**
   * PART: works home
   * コメント:
   * - 上段: [マイ本棚] ⇆ マイ作品
   * - 下段: 作品を作る / プロフィール設定 / Logout
   */
  if (props.current === "works") {
    return (
      <ControlBar
        title="[マイ本棚] ⇆ マイ作品"
        headline={
          <div className="flex flex-wrap items-center gap-2">
            <ControlBarLinkButton href="/mypage" tone="dark">
              マイ本棚
            </ControlBarLinkButton>
            <div className="opacity-50">⇆</div>
            <div className="text-sm font-semibold">マイ作品</div>
          </div>
        }
        actionLeft={
          <div className="flex min-h-[32px] items-center text-sm opacity-60">
            {/* 将来: 作品分類タブ / フィルタ予約スペース */}
          </div>
        }
        actionRight={
          <div className="flex flex-wrap items-center gap-2">
            <ControlBarButton onClick={props.onCreatePage}>
              PAGEを作る
            </ControlBarButton>

            <ControlBarButton onClick={props.onCreateBook}>
              BOOKを作る
            </ControlBarButton>

            <ControlBarLinkButton href="/my/profile?returnTo=%2Fmy%2Fworks" muted>
              ホームページ設定
            </ControlBarLinkButton>

            <ControlBarButton onClick={handleLogout} muted>
              Logout
            </ControlBarButton>
          </div>
        }
      />
    );
  }

  /**
   * PART: profile settings
   * コメント:
   * - 上段: [マイ本棚] ⇆ マイ作品
   * - 下段: マイ作品 / プロフィール設定 + 戻る
   */
  const returnTo = props.returnTo || "/my/works";

  return (
    <ControlBar
      headline={
        <div className="flex flex-wrap items-center gap-2">
          <ControlBarLinkButton href="/mypage" tone="dark">
            マイ本棚
          </ControlBarLinkButton>
          <div className="opacity-50">⇆</div>
          <div className="text-sm font-semibold">マイ作品</div>
        </div>
      }
      title="マイ作品 / プロフィール設定"
      backHref={returnTo}
      backLabel="← 戻る"
      actionRight={
        <div className="flex flex-wrap items-center gap-2">
          <ControlBarButton onClick={handleLogout} muted>
            Logout
          </ControlBarButton>
        </div>
      }
    />
  );
}
