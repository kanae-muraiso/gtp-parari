import "server-only";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { readSellerDisclosure, sellerDisclosureReady } from "@/lib/parari/sales/sellerDisclosure";
import { emptyClassBusinessFront, type ClassBusinessFront, type ClassBusinessFrontLink } from "./classBusinessFront";

export async function readClassBusinessFront(school: string): Promise<ClassBusinessFront> {
  const { data, error } = await db.from("class_business_fronts").select("draft,published,revision").eq("school_id", school).maybeSingle();
  if (error) throw error;
  return data ?? emptyClassBusinessFront;
}

export async function classBusinessFrontLinks(school: string, owner: string): Promise<ClassBusinessFrontLink[]> {
  const now = new Date().toISOString();
  const [recruitment, offers, products, events] = await Promise.all([
    db.from("school_recruitment").select("public_id,information,kind,route").eq("school_id", school).eq("enabled", true).maybeSingle(),
    db.from("school_recruitment_offers").select("id,name,information").eq("school_id", school).eq("enabled", true).order("name"),
    db.from("school_class_products").select("id,name,design").eq("school_id", school).order("name"),
    db.from("applications").select("id,title,class_event").eq("class_event_school_id", school)
      .eq("status", "open").is("archived_at", null).in("class_event->>audience", ["public", "mixed"])
      .or(`class_event->>startsAt.gte.${now},class_event->>lastStartsAt.gte.${now}`)
      .order("class_event->>startsAt").limit(100),
  ]);
  for (const result of [recruitment, offers, products, events]) if (result.error) throw result.error;

  const links: ClassBusinessFrontLink[] = [];
  if (recruitment.data) {
    const source = recruitment.data;
    const profile = await db.from("profiles").select("is_monitor").eq("user_id", owner).maybeSingle();
    if (profile.error) throw profile.error;
    if (profile.data?.is_monitor) {
      const label = source.route === "direct" ? "入会申込" : source.kind + "予約";
      const candidates = [{ id: source.public_id, title: label, information: source.information },
        ...(offers.data ?? []).map(offer => ({ id: offer.id, title: offer.name, information: offer.information }))];
      const shared = candidates.some(entry => !entry.information.trim()) &&
        sellerDisclosureReady(await readSellerDisclosure(owner));
      for (const entry of candidates) {
        if (entry.information.trim() || shared) {
          links.push({ key: "intake:" + entry.id, title: entry.title, label, href: "/class-intake/" + entry.id });
        }
      }
    }
  }
  for (const product of products.data ?? []) {
    const fee = product.design?.walkInFee;
    if (Number.isInteger(fee) && fee >= 0) {
      links.push({ key: "schedule:" + product.id, title: product.name, label: "開催日程", href: "/class-schedule/" + product.id });
    }
  }
  for (const event of events.data ?? []) {
    links.push({ key: "event:" + event.id, title: event.title, label: event.class_event.sessions ? "講習会" : "イベント",
      href: "/class-event/" + event.id });
  }
  return links;
}
