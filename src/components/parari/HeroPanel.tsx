// apps/tools/parari/src/components/parari/HeroPanel.tsx
// apps/tools/parari/src/components/parari/HeroPanel.tsx
// 2026-05-05 JST

"use client";

/**
 * PART: HeroPanel
 * コメント:
 * - ユーザーPAGE上部のヘッダー表示
 * - coverImageUrl は背景画像
 * - avatarUrl はプロフィール画像
 * - プロフィール画像は circle / logo / none を選べる
 * - プロフィール画像・名前・ユーザー名・紹介文をまとめて left / center / right に寄せる
 * - 空の項目は描画せず、余白を詰める
 */

type ProfileImageStyle = "circle" | "logo" | "none";
type ProfileAlign = "left" | "center" | "right";

type Props = {
  displayName: string;
  username: string;
  bio: string | null;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;

  profileImageStyle?: ProfileImageStyle;
  profileAlign?: ProfileAlign;
  showUsername?: boolean;

  showCTA?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
};

function getProfileAlignClass(align: ProfileAlign) {
  if (align === "center") {
    return {
      wrapper: "items-center text-center",
      image: "mx-auto",
      bio: "mx-auto",
    };
  }

  if (align === "right") {
    return {
      wrapper: "items-end text-right",
      image: "ml-auto",
      bio: "ml-auto",
    };
  }

  return {
    wrapper: "items-start text-left",
    image: "",
    bio: "",
  };
}

export default function HeroPanel({
  displayName,
  username,
  bio,
  avatarUrl,
  coverImageUrl,

  profileImageStyle = "circle",
  profileAlign = "left",
  showUsername = true,

  showCTA = false,
  ctaLabel = "参加登録",
  ctaHref = "/login",
}: Props) {
  const safeDisplayName = String(displayName ?? "").trim();
  const safeUsername = String(username ?? "").trim();
  const safeBio = String(bio ?? "").trim();
  const safeAvatarUrl = String(avatarUrl ?? "").trim();
  const safeCoverImageUrl = String(coverImageUrl ?? "").trim();

  const hasCover = Boolean(safeCoverImageUrl);
  const hasAvatar = Boolean(safeAvatarUrl) && profileImageStyle !== "none";
  const hasDisplayName = Boolean(safeDisplayName);
  const hasUsername = Boolean(safeUsername) && showUsername;
  const hasBio = Boolean(safeBio);
  const hasMainInfo =
    hasAvatar || hasDisplayName || hasUsername || hasBio || showCTA;

  const alignClass = getProfileAlignClass(profileAlign);

  return (
    <section className="mb-6 w-full">
      {/* PART: cover image */}
      {hasCover ? (
        <div className="h-44 w-full overflow-hidden bg-neutral-200">
          <img
            src={safeCoverImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      {/* PART: profile information */}
      {hasMainInfo ? (
        <div className={["px-4 pb-4", hasCover ? "pt-0" : "pt-4"].join(" ")}>
          <div
            className={[
              "flex gap-4",
              profileAlign === "right" ? "justify-end" : "",
              profileAlign === "center" ? "justify-center" : "justify-between",
              hasCover && hasAvatar && profileImageStyle === "circle"
                ? "-mt-12"
                : "",
            ].join(" ")}
          >
            <div
              className={[
                "flex min-w-0 flex-1 flex-col",
                alignClass.wrapper,
              ].join(" ")}
            >
              {/* PART: profile image */}
              {hasAvatar && profileImageStyle === "circle" ? (
                <div className={["mb-3", alignClass.image].join(" ")}>
                  <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-neutral-300">
                    <img
                      src={safeAvatarUrl}
                      alt={safeDisplayName || safeUsername || ""}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              ) : null}

              {hasAvatar && profileImageStyle === "logo" ? (
                <div className={["mb-4", alignClass.image].join(" ")}>
                  <img
                    src={safeAvatarUrl}
                    alt={safeDisplayName || safeUsername || ""}
                    className="max-h-24 max-w-[280px] object-contain"
                  />
                </div>
              ) : null}

              {/* PART: display name */}
              {hasDisplayName ? (
                <div className="text-2xl font-semibold leading-tight">
                  {safeDisplayName}
                </div>
              ) : null}

              {/* PART: username */}
              {hasUsername ? (
                <div
                  className={
                    hasDisplayName
                      ? "mt-1 text-sm text-gray-500"
                      : "text-sm text-gray-500"
                  }
                >
                  @{safeUsername}
                </div>
              ) : null}

              {/* PART: bio */}
              {hasBio ? (
                <div
                  className={[
                    "mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-gray-700",
                    alignClass.bio,
                  ].join(" ")}
                >
                  {safeBio}
                </div>
              ) : null}
            </div>

            {/* PART: CTA */}
            {showCTA ? (
              <div
                className={
                  hasCover && hasAvatar && profileImageStyle === "circle"
                    ? "shrink-0 pt-16"
                    : "shrink-0 pt-1"
                }
              >
                <a
                  href={ctaHref}
                  className="rounded-full border bg-white px-5 py-2.5 text-sm shadow-sm hover:bg-neutral-50"
                >
                  {ctaLabel}
                </a>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
