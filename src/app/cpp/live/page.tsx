import CppLiveSchedule from "@/components/parari/cpp/CppLiveSchedule";
import Link from "next/link";
export default function PublicCppLivePage(){
 return <main className="mx-auto max-w-6xl px-4 py-10">
 <h1 className="text-2xl font-bold">CPP MATCHING · LIVE</h1>
 <p className="mt-3 text-sm text-neutral-600">開催予定はどなたでもご覧いただけます。開催中の会場への入室は、ログインと参加資格が必要です。</p>
 <CppLiveSchedule/>
 <Link className="inline-block rounded-full bg-neutral-900 px-6 py-3 text-sm font-bold text-white" href="/my/cpp/live">LIVE会場の入口へ</Link>
 </main>;
}
