import Link from "next/link";
import { AlumniAccess, AlumniTitle, panel } from "@/components/parari/cpp/alumni/AlumniShared";

function AlumniLiveContent() {
  return <>
    <AlumniTitle title="同窓会 LIVE">CPP同窓会の仲間と、また話せる場所へ。</AlumniTitle>
    <section className={panel}>
      <h2 className="text-lg font-bold">同窓会 LIVE の準備中です</h2>
      <p className="mt-3 text-sm leading-7 text-neutral-600">
        同窓会登録者はこの入口を利用できます。研究者・企業向けの既存CPP LIVEとは参加資格を分離し、
        同窓会員だけで安心して話せる機能を準備しています。
        現在は通話の開催・入室はまだできません。
      </p>
      <Link href="/cpp/alumni/members" className="mt-5 inline-block rounded-full border border-neutral-300 px-5 py-3 text-sm font-bold">
        参加者一覧へ
      </Link>
    </section>
  </>;
}
export default function AlumniLivePage() {
  return <AlumniAccess><AlumniLiveContent /></AlumniAccess>;
}
