type VerificationPageProps = {
  searchParams:
    | Promise<{ state?: string }>
    | { state?: string };
};

function messageForState(
  state: string,
) {
  switch (state) {
    case "expired":
      return "確認リンクの有効期限が切れました。元のAPPLICATIONから、もう一度お申し込みください。";
    case "full":
      return "メール確認の時点で受付可能人数に達していました。";
    case "closed":
      return "メール確認の時点で、このAPPLICATIONの受付は終了していました。";
    case "invalid":
      return "この確認リンクは無効、またはすでに使用されています。";
    default:
      return "メールアドレスの確認を完了できませんでした。元のAPPLICATIONから、もう一度お試しください。";
  }
}

export default async function ApplicationVerificationPage({
  searchParams,
}: VerificationPageProps) {
  const params =
    await Promise.resolve(searchParams);
  const state =
    String(params?.state ?? "failed");

  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-12 sm:py-16">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-xs font-bold tracking-[0.18em] text-neutral-400">
          APPLICATION
        </div>
        <h1 className="mt-2 text-2xl font-bold text-neutral-950">
          メールアドレス確認
        </h1>
        <p className="mt-5 text-sm leading-7 text-neutral-700">
          {messageForState(state)}
        </p>
        <a
          href="/"
          className="mt-6 block w-full rounded-full border border-neutral-300 bg-white px-5 py-3 text-center text-sm font-bold text-neutral-700 transition hover:bg-neutral-100"
        >
          PARARIへ戻る
        </a>
      </div>
    </main>
  );
}
