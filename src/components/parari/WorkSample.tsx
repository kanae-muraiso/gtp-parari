import type { WorkPreview } from "@/lib/parari/sales/workPreview";

export default function WorkSample({preview}: {preview:WorkPreview}) {
  return <section aria-label="試し読み" className="mt-6 space-y-5">
    <h2 className="text-lg font-bold">試し読み</h2>
    {preview.pages.some(page=>page.blocks.length || page.title) ? preview.pages.map((page,index)=>
      <div key={index} className="space-y-4 border-b border-neutral-200 pb-5">
        {page.title && <h3 className="font-semibold">{page.title}</h3>}
        {page.blocks.map((block,i)=>block.kind==="image"
          ? <figure key={i}><img src={block.url} alt="" loading="lazy" className="max-h-96 w-auto" />
            {block.caption && <figcaption>{block.caption}</figcaption>}</figure>
          : <p key={i} className="whitespace-pre-wrap break-words leading-8">{block.text}</p>)}
      </div>
    ) : <p className="text-sm text-neutral-600">表示できる試し読み本文がありません。</p>}
  </section>;
}
