// src/lib/commerce/readerAccess.ts
// 2026-10-08 JST
// PART: One server-side entitlement decision for every public reader URL
import { syncSubscriptionReading } from "./syncSubscriptionReading";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { splitPaidContent, validEntitlement, validSubscription } from "./paywall";
import { buildPublicReaderDocument } from "@/lib/parari/buildPublicReaderDocument";
export type ReaderLocator = {
    id?: string;
    username?: string;
    workSlug?: string;
    pageSlug?: string | null;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const quoted = (value: string) => '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
function checked<T>({ data, error }: {
    data: T;
    error: any;
}): T { if (error)
    throw error; return data; }
export async function findReaderWork(locator: ReaderLocator) {
    let profile: any = null;
    if (locator.username) {
        profile = checked(await db.from("profiles").select("user_id,username,homepage_header_logo_url,avatar_url,cover_image_url").eq("username", locator.username).maybeSingle());
        if (!profile)
            return null;
    }
    let query = db.from("parari_books").select("id,owner,title,content,visibility,is_public,is_deleted,updated_at,expires_at").or("is_deleted.is.null,is_deleted.eq.false");
    if (profile)
        query = query.eq("owner", profile.user_id);
    const slug = locator.workSlug || locator.id;
    if (!slug || slug.length > 200)
        return null;
    if (locator.id && uuid.test(locator.id))
        query = query.eq("id", locator.id);
    else
        query = query.or(["slug", "stable_slug", "custom_slug"].map(key => `${key}.eq.${quoted(slug)}`).join(","));
    const work = checked(await query.maybeSingle());
    if (!work || (work.expires_at && Date.parse(work.expires_at) <= Date.now()))
        return null;
    return { work, profile };
}
export async function loadReader(locator: ReaderLocator, userId: string | null) {
    const found = await findReaderWork(locator);
    if (!found)
        return null;
    const { work, profile } = found;
    const split = splitPaidContent(work.content ?? "");
    let allowed = userId === work.owner;
    if (userId && !allowed) {
        const rights = checked(await db.from("commerce_entitlements").select("status,starts_at,expires_at,remaining_uses").eq("user_id", userId).eq("work_id", work.id));
        allowed = (rights ?? []).some(e => validEntitlement(e));
        if (!allowed) {
            const collab = checked(await db.from("parari_work_collaborators").select("role").eq("work_id", work.id).eq("user_id", userId).maybeSingle());
            allowed = collab?.role === "editor";
        }
        if (!allowed && work.visibility === "membership") {
            const links = checked(await db.from("membership_works").select("membership_id").eq("book_id", work.id));
            if (links?.length)
                allowed = !!checked(await db.from("membership_members").select("id").eq("user_id", userId).eq("status", "active").in("membership_id", links.map(l => l.membership_id)).limit(1).maybeSingle());
        }
    }
    const mapping = split.hasPaywall ? checked(await db.from("commerce_work_access").select("one_time_product_id,subscription_product_id,owner_user_id").eq("work_id", work.id).maybeSingle()) : null;
    if (mapping?.owner_user_id === work.owner && mapping.subscription_product_id && userId && !allowed) {
        const subscriptions = checked(await db.from("commerce_subscriptions").select("*").eq("buyer_user_id", userId).eq("owner_user_id", work.owner).eq("product_id", mapping.subscription_product_id));
        for (const subscription of subscriptions ?? []) {
            if (!subscription.access_until && subscription.last_payment_at && !subscription.access_invoice_id) {
                subscription.access_until = await syncSubscriptionReading(subscription);
            }
        }
        allowed = (subscriptions ?? []).some(s => validSubscription(s));
    }
    const visible = ["public", "unlisted"].includes(work.visibility ?? "") || (work.visibility == null && work.is_public === true);
    if (!visible && !allowed)
        return null;
    const locked = split.hasPaywall && !allowed;
    const productIds = mapping?.owner_user_id === work.owner ? [mapping.one_time_product_id, mapping.subscription_product_id].filter(Boolean) : [];
    const products = locked && productIds.length ? checked(await db.from("commerce_products").select("id,name,amount,currency,billing_interval").eq("owner_user_id", work.owner).eq("active", true).in("id", productIds)) : [];
    const publicBasePath = locator.username && locator.workSlug ? `/${encodeURIComponent(locator.username)}/${encodeURIComponent(locator.workSlug)}` : `/p/${work.id}`;
    return { id: work.id, owner: work.owner, locked, products: products ?? [],
        document: buildPublicReaderDocument({ content: locked ? split.preview : split.full, workId: work.id, pageSlug: locator.pageSlug, publicBasePath, headerLogoUrl: profile?.homepage_header_logo_url ?? profile?.avatar_url ?? null }) };
}
export type ReaderResponse = NonNullable<Awaited<ReturnType<typeof loadReader>>>;
