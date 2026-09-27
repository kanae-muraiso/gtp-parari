export default async function ApplicationPaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{
    entryId?: string;
  }>;
}) {
  const params = await searchParams;
  const entryId =
    typeof params.entryId === "string"
      ? params.entryId
      : "";

  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-16">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-neutral-900">
          お支払いを受け付けました
        </h1>

        <p className="mt-3 text-sm leading-7 text-neutral-600">
          Squareからの決済確認が届くと、PARARIの申込状態が自動で更新されます。
          反映まで少し時間がかかる場合があります。
        </p>

        {entryId ? (
          <p className="mt-4 break-all text-xs text-neutral-400">
            申込ID: {entryId}
          </p>
        ) : null}

        <a
          href="/my/applications"
          className="mt-6 inline-flex rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white"
        >
          申込一覧を確認
        </a>
      </div>
    </main>
  );
}
