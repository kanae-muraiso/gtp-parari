// src/components/parari/mvp/WorksList.tsx
// src/components/parari/mvp/WorksList.tsx
// 2026-06-23 JST
// PARARI MVP: 新旧作品を並べる作品リスト

import type {
  ParariWorkListItem,
  ParariWorkFormat,
} from "@/lib/parari/mvp/workTypes";

type WorksListMode = "owner" | "public";

type WorksListProps = {
  username: string;
  works: ParariWorkListItem[];
  mode?: WorksListMode;
  createPageHref?: string;
  getPageEditHref?: (work: ParariWorkListItem) => string;
  getLegacyBookEditHref?: (work: ParariWorkListItem) => string;
  getPublicViewHref?: (work: ParariWorkListItem) => string;
    onToggleShowInProfileWorks?: (
        work: ParariWorkListItem,
        nextShow: boolean,
      ) => void;
};

export function WorksList({
  username,
  works,
  mode = "owner",
  createPageHref = "/dev/mvp/page-editor-save",
  getPageEditHref = (work) => `/dev/mvp/pages/${work.id}/edit`,
  getLegacyBookEditHref = (work) => `/editor/${work.id}`,
  getPublicViewHref = (work) =>
    work.stableSlug.length > 0 ? `/${username}/${work.stableSlug}` : "",
  onToggleShowInProfileWorks,
}: WorksListProps) {
  const isOwnerMode = mode === "owner";
  const quickPageHref = "/editor/quick";

  const pageWorks = works.filter((work) => work.format === "page_v1");
  const legacyBookWorks = works.filter((work) => work.format === "book_legacy");
  const unknownWorks = works.filter((work) => work.format === "unknown");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-neutral-400">
              /{username}/works
            </div>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
            {isOwnerMode ? "作品リスト" : "作品"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            {isOwnerMode
              ? "新PAGE作品と旧BOOK作品を同じ一覧に並べます。MVPでは、新規作成はPAGE、旧BOOKは従来版で扱います。"
              : "公開されている作品を表示しています。"}
          </p>
          </div>

          {isOwnerMode ? (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={quickPageHref}
                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-700"
              >
                今すぐ書く
              </a>

              <a
                href={createPageHref}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
              >
                ＋新規作成
              </a>
            </div>
          ) : null}
        </div>

          {isOwnerMode ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <SummaryCard label="新PAGE" value={pageWorks.length} />
              <SummaryCard label="旧BOOK" value={legacyBookWorks.length} />
              <SummaryCard label="不明" value={unknownWorks.length} />
            </div>
          ) : null}
      </div>

      <div className="space-y-4">
        {works.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
            まだ作品がありません。
          </div>
        ) : (
          works.map((work) => (
                               <WorkCard
                                 key={work.id}
                                 work={work}
                                 mode={mode}
                                 pageEditHref={getPageEditHref(work)}
                                 legacyBookEditHref={getLegacyBookEditHref(work)}
                                 publicViewHref={getPublicViewHref(work)}
                                 onToggleShowInProfileWorks={onToggleShowInProfileWorks}
                               />
          ))
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-xs font-semibold text-neutral-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function WorkCard({
  work,
  mode,
  pageEditHref,
  legacyBookEditHref,
  publicViewHref,
  onToggleShowInProfileWorks,
}: {
  work: ParariWorkListItem;
  mode: WorksListMode;
  pageEditHref: string;
  legacyBookEditHref: string;
  publicViewHref: string;
  onToggleShowInProfileWorks?: (
    work: ParariWorkListItem,
    nextShow: boolean,
  ) => void;
}) {
  const isOwnerMode = mode === "owner";
  const formatLabel = getFormatLabel(work.format);
  const visibilityLabel = getVisibilityLabel(work.visibility);

  return (
    <article className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge>{formatLabel}</Badge>
            {isOwnerMode ? <Badge>{visibilityLabel}</Badge> : null}
            {isOwnerMode && work.entryMode ? (
              <Badge>entry: {work.entryMode}</Badge>
            ) : null}
          </div>

          <h2 className="break-words text-lg font-semibold text-neutral-900">
            {work.title}
          </h2>

          <div className="mt-2 text-xs leading-5 text-neutral-400">
            {isOwnerMode ? (
              <>
                <div>ID: {work.id}</div>
                <div>stable_slug: {work.stableSlug || "なし"}</div>
              </>
            ) : null}
            <div>updated: {formatDate(work.updatedAt)}</div>
          </div>
          
          {isOwnerMode ? (
            <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <label className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="block text-xs font-bold text-neutral-700">
                    作品一覧に表示
                  </span>
                  <span className="mt-1 block text-[11px] leading-5 text-neutral-400">
                    公開作品一覧にこの作品を載せます。公開設定が「公開」の作品だけ、読者に表示されます。
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={work.showInProfileWorks}
                  onChange={(event) =>
                    onToggleShowInProfileWorks?.(work, event.target.checked)
                  }
                  className="h-5 w-5 accent-neutral-900"
                />
              </label>
            </div>
          ) : null}
          
        </div>

          <div className="flex flex-wrap gap-2">
            {isOwnerMode ? (
              work.format === "page_v1" ? (
                <a
                  href={pageEditHref}
                  className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-neutral-800 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
                >
                  PAGE編集
                </a>
              ) : (
                <a
                  href={legacyBookEditHref}
                  className="rounded-full bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200"
                >
                  旧エディタ
                </a>
              )
            ) : null}

            {publicViewHref ? (
              <a
                href={publicViewHref}
                className="rounded-full bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700"
              >
                見る
              </a>
            ) : isOwnerMode ? (
              <button
                type="button"
                disabled
                className="rounded-full bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-400"
              >
                見る
              </button>
            ) : null}
          </div>
      </div>


    </article>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
      {children}
    </span>
  );
}

function getFormatLabel(format: ParariWorkFormat): string {
  if (format === "page_v1") {
    return "PAGE";
  }

  if (format === "book_legacy") {
    return "旧BOOK";
  }

  return "不明";
}

function getVisibilityLabel(value: string): string {
  if (value === "public") {
    return "公開";
  }

  if (value === "unlisted") {
    return "限定公開";
  }

  return "非公開";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ja-JP");
}
