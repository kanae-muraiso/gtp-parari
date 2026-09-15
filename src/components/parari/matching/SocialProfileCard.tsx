type SocialProfileCardProps = {
  displayName: string;
  photoUrl?: string | null;
  affiliation?: string | null;
  roleTitle?: string | null;
  topics?: string[] | null;
  intro?: string | null;
  compact?: boolean;
};

export default function SocialProfileCard({
  displayName,
  photoUrl,
  affiliation,
  roleTitle,
  topics = [],
  intro,
  compact = false,
}: SocialProfileCardProps) {
  const safeTopics = (topics ?? []).filter(Boolean).slice(0, compact ? 3 : 6);

  return (
    <article className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        <div className={`${compact ? "h-14 w-14" : "h-20 w-20"} shrink-0 overflow-hidden rounded-full bg-neutral-100`}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-black text-neutral-400">
              {displayName.trim().slice(0, 1) || "?"}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-black tracking-[0.15em] text-neutral-400">SOCIAL PROFILE</div>
          <h2 className={`${compact ? "mt-1 text-lg" : "mt-2 text-2xl"} font-black text-neutral-950`}>
            {displayName || "名前未設定"}
          </h2>
          {(affiliation || roleTitle) ? (
            <p className="mt-1 text-sm leading-6 text-neutral-600">
              {[affiliation, roleTitle].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      </div>

      {safeTopics.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {safeTopics.map((topic) => (
            <span key={topic} className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-700">
              {topic}
            </span>
          ))}
        </div>
      ) : null}

      {intro ? (
        <p className={`${compact ? "mt-4 line-clamp-2" : "mt-5"} text-sm leading-7 text-neutral-700`}>
          {intro}
        </p>
      ) : null}
    </article>
  );
}
