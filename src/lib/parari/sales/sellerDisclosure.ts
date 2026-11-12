import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export type SellerDisclosure = {
  owner_user_id: string;
  seller_type: "individual" | "company";
  legal_name: string;
  representative_name: string;
  postal_code: string;
  address: string;
  phone: string;
  contact_email: string;
  delivery_terms: string;
  return_terms: string;
  payment_terms: string;
  privacy_policy: string;
  published: boolean;
  updated_at: string;
};

export async function readSellerDisclosure(userId: string): Promise<SellerDisclosure | null> {
  const { data, error } = await supabaseAdmin
    .from("seller_disclosures")
    .select("*")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as SellerDisclosure | null) ?? null;
}

export function sellerDisclosureReady(row: SellerDisclosure | null): boolean {
  if (!row || !row.published) return false;
  return [
    row.legal_name, row.postal_code, row.address, row.phone,
    row.contact_email, row.delivery_terms, row.return_terms,
    row.payment_terms, row.privacy_policy,
  ].every(value => typeof value === "string" && value.trim().length > 0)
    && (row.seller_type !== "company" || Boolean(row.representative_name.trim()));
}

export function sellerPublicDisclosure(row: SellerDisclosure) {
  return {
    seller_type: row.seller_type,
    legal_name: row.legal_name,
    representative_name: row.representative_name,
    postal_code: row.postal_code,
    address: row.address,
    phone: row.phone,
    contact_email: row.contact_email,
    delivery_terms: row.delivery_terms,
    return_terms: row.return_terms,
    payment_terms: row.payment_terms,
    privacy_policy: row.privacy_policy,
    updated_at: row.updated_at,
  };
}
