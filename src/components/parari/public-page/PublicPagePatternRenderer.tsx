import type { ReactNode } from "react";

export type PublicPagePattern =
  | "person-first"
  | "offer-first"
  | "story-first"
  | "welcome-first";

type Props = {
  pattern: PublicPagePattern;

  displayName: string;
  username: string;
  bio?: string | null;
  profileBody?: string | null;

  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  showUsername?: boolean;

  showCTA?: boolean;
  ctaLabel?: string | null;
  ctaHref?: string | null;

  eventContent?: ReactNode;
  worksContent?: ReactNode;
  linksContent?: ReactNode;
};

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  if (!children) return null;

  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      {eyebrow ? (
        <div className="text-[10px] font-black tracking-[0.2em] text-neutral-400">
          {eyebrow}
        </div>
      ) : null}

      <h2 className="mt-2 text-2xl font-black tracking-tight text-neutral-950">
        {title}
      </h2>

      <div className="mt-6">
        {children}
      </div>
    </section>
  );
}

function CTA({
  show,
  label,
  href,
  light = false,
}: {
  show: boolean;
  label?: string | null;
  href?: string | null;
  light?: boolean;
}) {
  if (!show || !label || !href) return null;

  return (
    <a
      href={href}
      className={[
        "inline-flex rounded-full px-6 py-3 text-sm font-black transition",
        light
          ? "bg-white text-neutral-950 hover:bg-neutral-200"
          : "bg-neutral-950 text-white hover:bg-neutral-700",
      ].join(" ")}
    >
      {label}
    </a>
  );
}

function Avatar({
  avatarUrl,
  displayName,
  large = false,
}: {
  avatarUrl?: string | null;
  displayName: string;
  large?: boolean;
}) {
  const size = large
    ? "h-28 w-28"
    : "h-16 w-16";

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={displayName}
        className={`${size} rounded-full border-4 border-white object-cover shadow-sm`}
      />
    );
  }

  return (
    <div
      className={`${size} flex items-center justify-center rounded-full border-4 border-white bg-neutral-950 text-2xl font-black text-white shadow-sm`}
    >
      {(displayName.trim() || "P").slice(0, 1)}
    </div>
  );
}

export default function PublicPagePatternRenderer({
  pattern,
  displayName,
  username,
  bio,
  profileBody,
  avatarUrl,
  coverImageUrl,
  showUsername = true,
  showCTA = false,
  ctaLabel,
  ctaHref,
  eventContent,
  worksContent,
  linksContent,
}: Props) {
  const name =
    displayName.trim() ||
    username ||
    "PARARI USER";

  const safeBio = bio?.trim() || "";
  const safeBody = profileBody?.trim() || "";

  if (pattern === "offer-first") {
    const primaryContent =
      eventContent ||
      worksContent ||
      linksContent;

    const primaryTitle = eventContent
      ? "クラス・イベント"
      : worksContent
        ? "作品・活動"
        : "つながる";

    return (
      <main className="min-h-screen bg-[#f4f0e9]">
        <section className="mx-auto max-w-5xl px-5 pb-10 pt-12 sm:px-8 sm:pt-20">
          <div className="text-[10px] font-black tracking-[0.22em] text-[#8b725d]">
            WHAT I DO
          </div>

          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.08] tracking-tight text-neutral-950 sm:text-6xl">
            まず、
            <br />
            できることから。
          </h1>

          {safeBio ? (
            <p className="mt-6 max-w-2xl whitespace-pre-wrap text-base leading-8 text-neutral-600">
              {safeBio}
            </p>
          ) : null}

          <div className="mt-7">
            <CTA
              show={showCTA}
              label={ctaLabel}
              href={ctaHref}
            />
          </div>
        </section>

        {primaryContent ? (
          <section className="bg-white">
            <Section
              eyebrow="FEATURED"
              title={primaryTitle}
            >
              {primaryContent}
            </Section>
          </section>
        ) : null}

        <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
          <div className="flex items-center gap-4">
            <Avatar
              avatarUrl={avatarUrl}
              displayName={name}
            />

            <div>
              <div className="text-xl font-black text-neutral-950">
                {name}
              </div>

              {showUsername ? (
                <div className="mt-1 text-sm text-neutral-400">
                  @{username}
                </div>
              ) : null}
            </div>
          </div>

          {safeBody ? (
            <div className="mt-7 max-w-3xl whitespace-pre-wrap text-sm leading-8 text-neutral-700">
              {safeBody}
            </div>
          ) : null}
        </section>

        {eventContent && primaryContent !== eventContent ? (
          <Section
            eyebrow="EVENTS"
            title="クラス・イベント"
          >
            {eventContent}
          </Section>
        ) : null}

        {worksContent && primaryContent !== worksContent ? (
          <Section
            eyebrow="WORKS"
            title="作品"
          >
            {worksContent}
          </Section>
        ) : null}

        {linksContent && primaryContent !== linksContent ? (
          <Section
            eyebrow="LINKS"
            title="リンク"
          >
            {linksContent}
          </Section>
        ) : null}
      </main>
    );
  }

  if (pattern === "story-first") {
    return (
      <main className="min-h-screen bg-white">
        <section className="bg-[#19211e] text-white">
          <div className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-24">
            <div className="text-[10px] font-black tracking-[0.24em] text-[#9aaca2]">
              MY STORY
            </div>

            <h1 className="mt-6 text-4xl font-black leading-[1.1] tracking-tight sm:text-6xl">
              {safeBody
                ? safeBody.split("\n")[0]
                : safeBio || name}
            </h1>

            {safeBody ? (
              <div className="mt-8 max-w-2xl whitespace-pre-wrap text-base leading-9 text-[#d5ddd8]">
                {safeBody}
              </div>
            ) : null}

            <div className="mt-10 flex items-center gap-4">
              <Avatar
                avatarUrl={avatarUrl}
                displayName={name}
              />

              <div>
                <div className="font-black">
                  {name}
                </div>

                {showUsername ? (
                  <div className="mt-1 text-sm text-[#97a69e]">
                    @{username}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-8">
              <CTA
                show={showCTA}
                label={ctaLabel}
                href={ctaHref}
                light
              />
            </div>
          </div>
        </section>

        {eventContent ? (
          <Section
            eyebrow="ACTIVITY"
            title="活動・クラス"
          >
            {eventContent}
          </Section>
        ) : null}

        {worksContent ? (
          <Section
            eyebrow="WORKS"
            title="作品"
          >
            {worksContent}
          </Section>
        ) : null}

        {linksContent ? (
          <Section
            eyebrow="CONNECT"
            title="つながる"
          >
            {linksContent}
          </Section>
        ) : null}
      </main>
    );
  }

  if (pattern === "welcome-first") {
    return (
      <main className="min-h-screen bg-[#fbf7f0]">
        <section className="mx-auto max-w-4xl px-5 pb-8 pt-8 sm:px-8 sm:pt-14">
          <div className="overflow-hidden rounded-[32px] bg-[#e8b99c]">
            {coverImageUrl ? (
              <div className="h-48 overflow-hidden sm:h-72">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}

            <div className="p-6 sm:p-10">
              <div className="text-[10px] font-black tracking-[0.22em] text-[#735344]">
                WELCOME
              </div>

              <h1 className="mt-4 text-4xl font-black leading-[1.08] tracking-tight text-[#352823] sm:text-5xl">
                はじめまして。
                <br />
                {name}です。
              </h1>

              {safeBio ? (
                <p className="mt-6 max-w-2xl whitespace-pre-wrap text-base leading-8 text-[#664d42]">
                  {safeBio}
                </p>
              ) : null}

              <div className="mt-7">
                <CTA
                  show={showCTA}
                  label={ctaLabel}
                  href={ctaHref}
                />
              </div>
            </div>
          </div>
        </section>

        {eventContent ? (
          <Section
            eyebrow="START HERE"
            title="まず見てほしいもの"
          >
            {eventContent}
          </Section>
        ) : worksContent ? (
          <Section
            eyebrow="START HERE"
            title="まず見てほしいもの"
          >
            {worksContent}
          </Section>
        ) : null}

        {safeBody ? (
          <Section
            eyebrow="ABOUT"
            title="もう少し詳しく"
          >
            <div className="max-w-3xl whitespace-pre-wrap text-sm leading-8 text-neutral-700">
              {safeBody}
            </div>
          </Section>
        ) : null}

        {worksContent && eventContent ? (
          <Section
            eyebrow="WORKS"
            title="作品"
          >
            {worksContent}
          </Section>
        ) : null}

        {linksContent ? (
          <Section
            eyebrow="LINKS"
            title="つながる"
          >
            {linksContent}
          </Section>
        ) : null}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <section>
        <div className="relative">
          <div className="h-[42vh] min-h-[300px] max-h-[520px] overflow-hidden bg-neutral-200">
            {coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full bg-gradient-to-br from-neutral-300 via-neutral-100 to-neutral-200" />
            )}
          </div>

          <div className="mx-auto max-w-5xl px-5 sm:px-8">
            <div className="-mt-14 relative">
              <Avatar
                avatarUrl={avatarUrl}
                displayName={name}
                large
              />
            </div>

            <div className="pb-10 pt-5">
              <div className="text-[10px] font-black tracking-[0.2em] text-neutral-400">
                PERSON FIRST
              </div>

              <h1 className="mt-2 text-4xl font-black tracking-tight text-neutral-950 sm:text-5xl">
                {name}
              </h1>

              {showUsername ? (
                <div className="mt-2 text-sm text-neutral-400">
                  @{username}
                </div>
              ) : null}

              {safeBio ? (
                <p className="mt-6 max-w-2xl whitespace-pre-wrap text-base leading-8 text-neutral-700">
                  {safeBio}
                </p>
              ) : null}

              <div className="mt-7">
                <CTA
                  show={showCTA}
                  label={ctaLabel}
                  href={ctaHref}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {eventContent ? (
        <Section
          eyebrow="ACTIVITY"
          title="活動・クラス"
        >
          {eventContent}
        </Section>
      ) : null}

      {safeBody ? (
        <Section
          eyebrow="ABOUT"
          title={`${name}について`}
        >
          <div className="max-w-3xl whitespace-pre-wrap text-sm leading-8 text-neutral-700">
            {safeBody}
          </div>
        </Section>
      ) : null}

      {worksContent ? (
        <Section
          eyebrow="WORKS"
          title="作品"
        >
          {worksContent}
        </Section>
      ) : null}

      {linksContent ? (
        <Section
          eyebrow="LINKS"
          title="リンク"
        >
          {linksContent}
        </Section>
      ) : null}
    </main>
  );
}
