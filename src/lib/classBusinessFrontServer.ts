import "server-only";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { readSellerDisclosure, sellerDisclosureReady } from "@/lib/parari/sales/sellerDisclosure";
import { classIntakeTarget } from "./classIntakeTargets";
import { readClassIntakeCalendar } from "./classIntakeCalendarServer";
import type { ClassProduct } from "./classProduct";
import type { SchoolClass } from "./classes";
import { normalizeClassBusinessEntries, classBusinessEntryKey, classParticipationFormat, classParticipationFormats, emptyClassBusinessFront, type ClassBusinessFront, type ClassBusinessFrontLink } from "./classBusinessFront";

export async function readClassBusinessFront(school: string): Promise<ClassBusinessFront> {
  const { data, error } = await db.from("class_business_fronts").select("draft,published,revision").eq("school_id", school).maybeSingle();
  if (error) throw error;
  if (!data) return emptyClassBusinessFront;
  return { revision: data.revision, draft: normalizeClassBusinessEntries(data.draft),
    published: data.published ? normalizeClassBusinessEntries(data.published) : null };
}

export async function classBusinessFrontLinks(school: string, owner: string, selected?: string[]): Promise<ClassBusinessFrontLink[]> {
  const now = new Date().toISOString();
  const [recruitment, offers, products, events] = await Promise.all([
    db.from("school_recruitment").select("public_id,information,kind,route").eq("school_id", school).eq("enabled", true).maybeSingle(),
    db.from("school_recruitment_offers").select("id,name,information,route_override,class_ids").eq("school_id", school).eq("enabled", true).eq("link_only", false).order("name"),
    db.from("school_class_products").select("id,name,design").eq("school_id", school).order("name"),
    db.from("applications").select("id,title,class_event").eq("class_event_school_id", school)
      .eq("status", "open").is("archived_at", null).in("class_event->>audience", ["public", "mixed"])
      .or(`class_event->>startsAt.gte.${now},class_event->>lastStartsAt.gte.${now}`)
      .order("class_event->>startsAt").limit(100),
  ]);
  for (const result of [recruitment, offers, products, events]) if (result.error) throw result.error;

  const links: ClassBusinessFrontLink[] = [];
  const selectedKeys = selected && new Set(selected.map(classBusinessEntryKey));
  const productIds = (products.data ?? []).filter(product =>
    !selectedKeys || selectedKeys.has("product:" + product.id)).map(product => product.id);
  const [slotsResult, calendar] = productIds.length ? await Promise.all([
    db.from("school_classes").select("id,product_id,name,starts_on,starts_at,cadence,location,delivery,schedule_rules,fee_override_yen")
      .eq("school_id", school).in("product_id", productIds).order("name"),
    readClassIntakeCalendar(school),
  ]) : [null, undefined];
  if (slotsResult?.error) throw slotsResult.error;
  const slots = (slotsResult?.data ?? []) as SchoolClass[];
  if (recruitment.data) {
    const source = recruitment.data;
    const profile = await db.from("profiles").select("is_monitor").eq("user_id", owner).maybeSingle();
    if (profile.error) throw profile.error;
    if (profile.data?.is_monitor) {
      const label = source.route === "direct" ? "入会申込" : source.kind + "予約";
      const candidates = [{ id: source.public_id, title: label, information: source.information, route: source.route },
        ...(offers.data ?? []).map(offer => ({ id: offer.id, title: offer.name, information: offer.information, route: offer.route_override ?? source.route }))];
      const shared = candidates.some(entry => !entry.information.trim()) &&
        sellerDisclosureReady(await readSellerDisclosure(owner));
      for (const entry of candidates) {
        if (entry.information.trim() || shared) {
          links.push({ key: "intake:" + entry.id, title: entry.title, label: entry.route === "direct" ? "入会申込" : source.kind + "予約", href: "/class-intake/" + entry.id });
        }
      }
    }
  }
  for (const product of products.data ?? []) {
    if (!productIds.includes(product.id)) continue;
    const design = product.design as ClassProduct;
    const walkIn = Number.isInteger(design.walkInFee) && (design.walkInFee ?? -1) >= 0;
    const format = classParticipationFormat(design);
    const productSlots = slots.filter(slot => slot.product_id === product.id && (!walkIn || slot.delivery === "onsite"));
    links.push({ key: "product:" + product.id, title: product.name,
      label: classParticipationFormats[format], ...(walkIn ? { href: "/class-schedule/" + product.id } : {}), format,
      course: {
        id: product.id, description: design.description || "", walkIn,
        intakes: recruitment.data ? (offers.data ?? []).filter(offer => productSlots.some(slot => offer.class_ids.includes(slot.id))).map(offer => ({
          title: offer.name, label: (offer.route_override ?? recruitment.data!.route) === "direct" ? "入会を申し込む" : recruitment.data!.kind + "を予約する",
          href: "/class-intake/" + offer.id,
        })) : [],
        explanation: walkIn ? "予約不要・当日参加" : design.booking === "flexible" ? "空席のある回をその都度予約" :
          design.makeup === "approval" ? "先生の承認で空いている回に振替" :
          design.makeup === "notice" ? "事前連絡した欠席分を空いている回に振替" : "",
        slots: productSlots.map(slot => classIntakeTarget(slot, { name: "", monthlyFee: walkIn ? design.walkInFee ?? undefined : design.monthlyFee },
          calendar, walkIn)),
      },
    });
  }
  for (const event of events.data ?? []) {
    links.push({ key: "event:" + event.id, title: event.title, label: event.class_event.sessions ? "講習会" : "イベント",
      href: "/class-event/" + event.id, format: "open", startsAt: event.class_event.startsAt });
  }
  return links;
}
