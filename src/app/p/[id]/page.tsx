// src/app/p/[id]/page.tsx
// 2026-10-08 JST / PART: Canonical reader via server-authorized display data
import PublicWorkLoader from "@/components/parari/PublicWorkLoader";
export default async function PublicPage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params; return <PublicWorkLoader id={id}/>;
}
