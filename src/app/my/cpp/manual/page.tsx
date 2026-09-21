import Link from "next/link";
import CppSectionNav from "@/components/parari/cpp/CppSectionNav";

const steps = [
  {
    number: "01",
    title: "プロフィールを準備する",
    body: "研究者は研究者プロフィール、企業は企業案内を作成します。CPP LIVEで使う短いSOCIAL PROFILEは別に用意します。",
  },
  {
    number: "02",
    title: "相手を閲覧する",
    body: "研究者には参加企業、企業には参加研究者が表示されます。詳しい情報は各カードから確認できます。",
  },
  {
    number: "03",
    title: "CPP LIVEに入る",
    body: "LIVE入口で参加人数を確認し、「LIVEに入る」を押した時点でほかの参加者に表示されます。ページを開いただけでは参加になりません。",
  },
  {
    number: "04",
    title: "話せる状態を伝える",
    body: "状態は「話せます」と「離席中」の2つです。離席中にも話しかけてもらえますが、自分から新しい会話は始められません。",
  },
];

export default function CppManualPage() {
  return (
    <>
      <CppSectionNav active="manual" />
      <main className="min-h-screen bg-neutral-100 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-4xl">
          <header>
            <div className="text-xs font-black tracking-[0.18em] text-neutral-400">CPP GUIDE</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-neutral-950">マニュアル</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">
              CPPの基本的な使い方です。各機能へは上のメニューまたはCPPホームから移動できます。
            </p>
          </header>

          <div className="mt-8 space-y-4">
            {steps.map((step) => (
              <section key={step.number} className="grid gap-4 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:grid-cols-[4rem_1fr] sm:p-8">
                <div className="text-2xl font-black text-neutral-300">{step.number}</div>
                <div>
                  <h2 className="text-xl font-black text-neutral-950">{step.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-neutral-600">{step.body}</p>
                </div>
              </section>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/my/cpp/home" className="rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white">
              CPPホームへ戻る
            </Link>
            <Link href="/my/cpp/live" className="rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-bold text-neutral-800">
              CPP LIVE入口へ
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
