// src/app/[username]/[workSlug]/[pageSlug]/page.tsx
// 2026-10-08 JST / PART: Public slug URL uses the unified authorized reader
import PublicWorkLoader from "@/components/parari/PublicWorkLoader";
import { readerMetadata } from "@/lib/commerce/readerMetadata";
type Props={params:Promise<{username:string;workSlug:string;pageSlug:string;}>};
export const dynamic="force-dynamic";
export async function generateMetadata({params}:Props) { return readerMetadata(await params); }
export default async function PublicWorkPage({params}:Props) { return <PublicWorkLoader {...await params}/>; }
