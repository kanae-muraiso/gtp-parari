import "server-only";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { parseBookPageRefs, resolveBookPageRefs } from "@/lib/parari/book/pageRefs";
import { isWebLikeSsot } from "@/components/parari/viewer-v2/web/webSsot";
import { isBookLikeSsot } from "@/components/parari/viewer-v2/book/buildBookSheets";
import { buildWorkPreview } from "./workPreview";

export const saleWorkFields = "id,owner,title,content,is_deleted,visibility,is_public,expires_at";

export function saleWorkIsAvailable(work: {is_deleted:boolean|null;expires_at:string|null}) {
  return !work.is_deleted && (!work.expires_at || Date.parse(work.expires_at) > Date.now());
}

export async function previewForWork(work: {owner:string;content:string|null}, count: number) {
  const source = work.content ?? "";
  if (isWebLikeSsot(source)) return null;
  const ids = [...new Set(parseBookPageRefs(source).slice(0,count).map(ref=>ref.id))];
  if (!ids.length) return buildWorkPreview(source,count);

  // Only selected references may contribute data to the sample.
  const [{data,error},protectedIds] = await Promise.all([
    supabaseAdmin.from("parari_books").select("id,title,content,is_deleted")
      .eq("owner",work.owner).in("id",ids),
    protectedSaleWorkIds(ids),
  ]);
  if (error) throw error;
  const pages = new Map(ids.map(id=>{
    const page = data?.find(row=>row.id===id);
    const body = String(page?.content ?? "");
    if (!page || page.is_deleted || protectedIds.has(id) || isWebLikeSsot(body) || isBookLikeSsot(body)) {
      return [id,"[PAGE]\ntitle: 試し読み対象外"];
    }
    const title = String(page.title ?? "").replace(/[\r\n]/g," ").trim() || "無題のPAGE";
    return [id, /^\s*\[(?:PAGE|PAGEINFO)\b/im.test(body) ? body : `[PAGE]\ntitle: ${title}\n\n${body}`];
  }));
  return buildWorkPreview(resolveBookPageRefs(source,pages),count);
}

export async function protectedSaleWorkIds(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const {data,error} = await supabaseAdmin.from("commerce_products").select("work_id")
    .eq("product_type","work").in("work_id",ids).or("active.eq.true,listing_visibility.not.is.null");
  if (error) throw error;
  return new Set<string>((data ?? []).map(row=>row.work_id));
}

export async function workSaleHrefForAuthor(identifier: string, username: string) {
  const {data: profile} = await supabaseAdmin.from("profiles").select("user_id").eq("username",username).maybeSingle();
  return profile ? workSaleHref(identifier,profile.user_id) : null;
}

export async function workSaleHref(identifier: string, owner?: string) {
  const value = '"' + identifier.replace(/[\\"]/g,"\\$&") + '"';
  const filters = ["slug","stable_slug","custom_slug"].map(field=>field+".eq."+value);
  if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(identifier)) filters.push("id.eq."+value);
  const query = supabaseAdmin.from("parari_books").select("id,is_deleted,expires_at").or(filters.join(",")).limit(2);
  if (owner) query.eq("owner",owner);
  const {data,error} = await query;
  if (error || data?.length !== 1 || !saleWorkIsAvailable(data[0])) return null;
  const {data:product} = await supabaseAdmin.from("commerce_products").select("id")
    .eq("work_id",data[0].id).eq("product_type","work").eq("active",true).not("listing_visibility","is",null).maybeSingle();
  return product ? `/buy/${product.id}` : null;
}

export async function canReadPurchasedWork(work: {id:string;owner:string}, token: string) {
  if (!token) return false;
  const {data:{user}} = await supabaseAdmin.auth.getUser(token);
  if (!user) return false;
  if (work.owner === user.id) return true;
  const now = new Date().toISOString();
  const {data} = await supabaseAdmin.from("commerce_entitlements").select("id")
    .eq("user_id",user.id).eq("work_id",work.id).eq("status","active").lte("starts_at",now)
    .or(`expires_at.is.null,expires_at.gt.${now}`).or("remaining_uses.is.null,remaining_uses.gt.0").limit(1).maybeSingle();
  return Boolean(data);
}
