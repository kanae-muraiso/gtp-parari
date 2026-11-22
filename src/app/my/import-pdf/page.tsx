import Link from "next/link";
import PdfTextImporter from "@/components/parari/import/PdfTextImporter";

export default function ImportPdfPage() {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/editor/new" className="mb-5 inline-block text-sm text-neutral-600 underline">
          ← 新規作成に戻る
        </Link>
        <PdfTextImporter />
      </div>
    </main>
  );
}
