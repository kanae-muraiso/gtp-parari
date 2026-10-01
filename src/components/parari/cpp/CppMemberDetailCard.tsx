import Link from "next/link";

type Props = {
  kind: "researcher" | "company" | null;
  canView: boolean;
  available: boolean;
  targetId: string | null;
  error?: string;
};

export default function CppMemberDetailCard({ kind, canView, available, targetId, error }: Props) {
  const company = kind === "company";
  const href = targetId && kind ? `/cpp/${kind}/${targetId}` : null;

  return <section className="mt-5 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-7">
    {canView ? <>
      <div className="text-xs font-black tracking-[0.15em] text-neutral-400">{company ? "COMPANY PROFILE" : "RESEARCHER PROFILE"}</div>
      <h2 className="mt-2 text-xl font-black text-neutral-950">{company ? "会社案内・募集情報" : "研究者プロフィール"}</h2>
      <p className="mt-3 text-sm leading-7 text-neutral-600">
        {company ? "企業が公開した会社案内や募集情報を閲覧できます。" : "研究者がCPP参加企業に公開したプロフィールを閲覧できます。"}
      </p>
      {error ? <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : available && href ? (
        <Link href={href} className="mt-5 inline-flex rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white">
          {company ? "会社案内・募集情報を見る →" : "研究者プロフィールを見る →"}
        </Link>
      ) : <p className="mt-5 rounded-2xl bg-neutral-50 px-4 py-3 text-sm font-semibold leading-7 text-neutral-500">
        {company ? "会社案内・募集情報は準備中です。公開されると、ここから閲覧できます。" : "プロフィールは未公開、または企業会員の閲覧条件を満たしていません。"}
      </p>}
    </> : <>
      <div className="text-xs font-black tracking-[0.15em] text-neutral-400">SOCIAL PROFILE</div>
      <p className="mt-2 text-sm leading-7 text-neutral-600">同じ立場のメンバーのため、ここでは交流用の名札を表示しています。</p>
    </>}
  </section>;
}
