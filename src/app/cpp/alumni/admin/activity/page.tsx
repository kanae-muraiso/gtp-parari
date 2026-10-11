import { AlumniAccess, AlumniTitle } from "@/components/parari/cpp/alumni/AlumniShared";
import AlumniMessageActivity from "@/components/parari/cpp/alumni/AlumniMessageActivity";
export default function AlumniActivityPage() {
  return <AlumniAccess adminOnly><AlumniTitle title="交流状況">メッセージ本文や相手を見ずに、交流の動きだけ把握できます。</AlumniTitle><AlumniMessageActivity /></AlumniAccess>;
}