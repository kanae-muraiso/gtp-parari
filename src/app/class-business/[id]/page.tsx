import { notFound } from "next/navigation";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern } from "@/lib/classes";
import { selectClassBusinessFrontLinks } from "@/lib/classBusinessFront";
import { classBusinessFrontLinks, readClassBusinessFront } from "@/lib/classBusinessFrontServer";
import ClassBusinessFrontView from "@/components/parari/classes/ClassBusinessFrontView";

export const dynamic = "force-dynamic";

export default async function ClassBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!classIdPattern.test(id)) notFound();
  const schoolResult = await db.from("class_schools").select("name,owner_user_id").eq("id", id)
    .is("archived_at", null).maybeSingle();
  if (schoolResult.error) throw schoolResult.error;
  const school = schoolResult.data;
  if (!school) notFound();
  const { published } = await readClassBusinessFront(id);
  if (!published) notFound();
  const links = published.entries.length ? await classBusinessFrontLinks(id, school.owner_user_id, published.entries) : [];
  return <main className="min-h-screen bg-neutral-50 px-5 py-12 sm:py-20">
    <ClassBusinessFrontView name={school.name} introduction={published.introduction}
      links={selectClassBusinessFrontLinks(published.entries, links)} schoolId={id} />
  </main>;
}
