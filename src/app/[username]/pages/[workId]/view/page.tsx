// src/app/[username]/pages/[workId]/view/page.tsx
// 2026-10-08 JST / PART: Legacy URL, same username/owner check and unified reader
import PublicWorkLoader from "@/components/parari/PublicWorkLoader";
export default async function LegacyPage({params}:{params:Promise<{username:string;workId:string}>}) {
 const {username,workId}=await params; return <PublicWorkLoader id={workId} username={username}/>;
}
