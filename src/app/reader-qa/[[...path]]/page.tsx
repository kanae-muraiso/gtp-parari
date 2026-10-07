import { ParariViewer } from "@/components/parari/viewer-v2/ParariViewer";
const text = "Hello [[漢字|かんじ]] world.\n\n## Heading one\n\n" + Array.from({length:36},(_,i) => `Paragraph ${i+1}. This is original reading text for pagination and font reflow. 日本語の本文をここに入れて文字の折り返しを確認します。`).join("\n\n");
const sources = {
 book: `[BOOK]\ntitle: Existing Book\ndefaultReadingMode: scroll\n\n[CHAPTER] Chapter One\n\n[PAGE] Page One\n${text}\n\n[PAGE] Page Two\nLast original page.`,
 page: `[PAGE]\ntitle: Existing Page\n\n[T]\n${text}\n\n[NOTICE] Important notice`,
 web: `[WEB]\ntitle: Existing Site\nhomePageSlug: home\ntopBrandName: Existing Brand\nfixedBrandName: Existing Brand\n\n[WEBPAGE]\npageType: top\ntitle: Home\nslug: home\nisHome: true\n\n[T]\n${text}\n[/WEBPAGE]\n\n[WEBPAGE]\npageType: fixed\ntitle: About\nslug: about\n\n[T]\nAbout page body. ${text}\n[/WEBPAGE]`,
};
export default async function Page({ params, searchParams }: { params: Promise<{path?:string[]}>; searchParams:Promise<{format?:string}> }) {
 const {path=[]}=await params; const query=await searchParams; const format=(path[0] || query.format || "book") as keyof typeof sources;
 return <><div className="sticky top-0 z-[9999] h-12 border-b bg-white px-4 py-3">PARARI QA</div><ParariViewer content={sources[format] || sources.book} workId={`qa-${format}`} pageSlug={path[1] || null} publicBasePath="/reader-qa/web" /></>;
}
