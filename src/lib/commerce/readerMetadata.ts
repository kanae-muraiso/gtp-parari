// src/lib/commerce/readerMetadata.ts
// 2026-10-08 JST / PART: Public metadata uses only the free preview
import { findReaderWork, type ReaderLocator } from "./readerAccess";
import { splitPaidContent } from "./paywall";
import { buildDefaultPublicMetadata, buildPublicWorkMetadata } from "@/lib/parari/metadata/publicWorkMetadata";
export async function readerMetadata(locator: ReaderLocator) {
    const url = `https://www.parari.app/${encodeURIComponent(locator.username ?? "")}/${encodeURIComponent(locator.workSlug ?? "")}` + (locator.pageSlug ? `/${encodeURIComponent(locator.pageSlug)}` : "");
    try {
        const found = await findReaderWork(locator);
        if (!found || !["public", "unlisted"].includes(found.work.visibility ?? ""))
            return buildDefaultPublicMetadata(url);
        return buildPublicWorkMetadata({ content: splitPaidContent(found.work.content ?? "").preview, fallbackTitle: found.work.title, brandImages: found.profile ?? {}, url });
    }
    catch {
        return buildDefaultPublicMetadata(url);
    }
}
