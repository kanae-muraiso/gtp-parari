import { notFound } from "next/navigation";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern } from "@/lib/classes";
import { selectClassBusinessFrontLinks } from "@/lib/classBusinessFront";
import { classBusinessFrontLinks, readClassBusinessFront } from "@/lib/classBusinessFrontServer";
import ClassBusinessFrontView from "@/components/parari/classes/ClassBusinessFrontView";
import { eligibleClassHomePage } from "@/lib/classHomePage";

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
  // A private PAGE must never be exposed by the public CLASS front.
  const binding = await db.from("class_onboarding_drafts").select("landing_page_id")
    .eq("school_id", id).maybeSingle();
  if (binding.error) throw binding.error;
  const page = binding.data?.landing_page_id
    ? await db.from("parari_books").select("id,title,visibility,is_public,is_deleted,content")
      .eq("id", binding.data.landing_page_id).eq("owner", school.owner_user_id)
      .maybeSingle() : null;
  if (page?.error) throw page.error;
  const publicPage = page?.data && !page.data.is_deleted &&
    eligibleClassHomePage(page.data.content, id) &&
    (page.data.visibility === "public" || (page.data.visibility == null && page.data.is_public === true))
      ? { id: page.data.id, title: page.data.title, content: page.data.content } : null;
  return <main className="min-h-screen bg-neutral-50 px-5 py-12 sm:py-20">
    <ClassBusinessFrontView name={school.name} introduction={published.introduction}
      links={selectClassBusinessFrontLinks(published.entries, links)} schoolId={id} homePage={publicPage} />
  </main>;
}
