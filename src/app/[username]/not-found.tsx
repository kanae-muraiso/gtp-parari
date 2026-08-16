// apps/tools/parari/src/app/[username]/not-found.tsx
// apps/tools/parari/src/app/[username]/not-found.tsx
// 2026-03-19 JST

import Link from "next/link";

export default function UserProfileNotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-neutral-900">
        この作者ページは見つかりませんでした
      </h1>

      <p className="mt-3 text-sm leading-6 text-neutral-500">
        ユーザーネームが存在しないか、まだ公開設定が完了していない可能性があります。
      </p>

      <Link
        href="/"
        className="mt-6 rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
      >
        トップへ戻る
      </Link>
    </main>
  );
}
