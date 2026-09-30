import Link from "next/link";
export type MessageTarget = { user_id: string; display_name: string; accepting: boolean; blocked_by_me: boolean; existing: boolean };
export default function CppMessageAction({ target, own = false }: { target: MessageTarget; own?: boolean }) {
  return <div className="mt-4 flex flex-wrap items-center gap-3"><span className={`text-xs font-bold ${target.accepting ? "text-emerald-700" : "text-neutral-500"}`}>{target.accepting ? "メッセージ受付中" : "メッセージ受付停止中"}</span>{!own ? <Link href={`/my/cpp/messages?to=${target.user_id}`} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-700">{target.blocked_by_me ? "会話・ブロック設定" : "メッセージ"}</Link> : null}</div>;
}
