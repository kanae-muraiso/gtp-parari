// PARARI package storefront. Product labels are independent of stored billing codes.
// Availability is defined here for display; purchase eligibility is enforced by the checkout API.
import Link from "next/link";
import { PLAN_ENTITLEMENTS } from "@/lib/billing/plan";

const upcoming = [
  {
    line: "WRITERS",
    caption: "書く・出版する",
    packages: [{ name: "WRITERS C", description: "高度な制作・運営向け。提供内容を検討中です。" }],
  },
  {
    line: "CLASS",
    caption: "教室・サークルを運営する",
    packages: [
      { name: "CLASS A", description: "小さなクラスを無料から始めるための構成。" },
      { name: "CLASS B", description: "クラスの規模が育った方向けの構成。" },
      { name: "CLASS C", description: "複数クラス・大規模運営向けの構成。" },
    ],
  },
  {
    line: "BUSINESS",
    caption: "自分の商品・サービスを販売する",
    packages: [
      { name: "BUSINESS A", description: "事業を小さく始めるための構成。" },
      { name: "BUSINESS B", description: "販売・予約などの事業運営向け構成。" },
      { name: "BUSINESS C", description: "高度な運営と自動化のための構成。" },
    ],
  },
] as const;

function AvailabilityCard({ name, description }: { name: string; description: string }) {
  return (
    <article aria-label={`${name}（準備中）`} className="rounded-2xl border border-neutral-200 bg-neutral-100 p-5 text-neutral-400">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-base font-bold text-neutral-500">{name}</h4>
        <span className="rounded-full border border-neutral-200 px-2 py-1 text-[10px] font-semibold">準備中</span>
      </div>
      <p className="min-h-12 text-xs leading-6">{description}</p>
      <div aria-disabled="true" className="mt-5 rounded-xl border border-neutral-200 bg-neutral-200 px-4 py-3 text-center text-xs font-bold text-neutral-400">
        現在は選択できません
      </div>
    </article>
  );
}

export default function PackageStore() {
  const free = PLAN_ENTITLEMENTS.free;
  const plus = PLAN_ENTITLEMENTS.plus;
  return (
    <div className="space-y-8">
      <section aria-labelledby="writers-packages">
        <div className="mb-4">
          <p className="text-xs font-semibold tracking-[0.16em] text-neutral-400">01 / WRITERS</p>
          <h2 id="writers-packages" className="mt-1 text-xl font-bold text-neutral-950">ライターズパッケージ</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">作品を書いて公開する。必要になったら制作の上限を広げる。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <article className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-neutral-950">WRITERS A</h3>
              <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold text-neutral-600">利用可能</span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">従来のFreeプラン</p>
            <p className="mt-4 text-3xl font-bold text-neutral-950">無料</p>
            <p className="mt-3 text-sm leading-6 text-neutral-600">まずは無料で書き、読者に作品を届ける。</p>
            <ul className="mt-4 flex-1 space-y-2 text-xs leading-6 text-neutral-700">
              <li>BOOK：{free.bookLimit}冊</li>
              <li>公開作品：{free.publishedWorkLimit}作品まで</li>
              <li>1 BOOK：{free.pageLimitPerWork} PAGEまで</li>
              <li>画像保存：{Math.round((free.imageStorageLimitBytes ?? 0) / 1048576)}MB</li>
              <li>作品販売も可能（販売手数料{free.salesFeeBps / 100}%）</li>
            </ul>
            <Link href="/my/start-studio" className="mt-6 block rounded-full border border-neutral-300 bg-white px-4 py-3 text-center text-sm font-bold text-neutral-900 hover:bg-neutral-50">
              無料で作品をつくる
            </Link>
          </article>

          <article className="flex flex-col rounded-2xl border-2 border-neutral-900 bg-neutral-950 p-5 text-white shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold">WRITERS B</h3>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-neutral-950">円建て申込準備中</span>
            </div>
            <p className="mt-1 text-xs text-neutral-300">従来のPlusプラン</p>
            <p className="mt-4 text-3xl font-bold">500円 <span className="text-sm font-normal text-neutral-300">/月（予定）</span></p>
            <p className="mt-3 text-sm leading-6 text-neutral-200">より多くの作品制作と電子書籍出版に。</p>
            <ul className="mt-4 flex-1 space-y-2 text-xs leading-6 text-neutral-200">
              <li>BOOK：{plus.bookLimit}冊</li>
              <li>公開作品：{plus.publishedWorkLimit}作品まで</li>
              <li>1 BOOK：{plus.pageLimitPerWork} PAGEまで</li>
              <li>画像保存：{Math.round((plus.imageStorageLimitBytes ?? 0) / 1073741824)}GB</li>
              <li>EPUB3出力・共同編集</li>
              <li>作品販売手数料：{plus.salesFeeBps / 100}%</li>
            </ul>
          </article>

          <AvailabilityCard name="WRITERS C" description={upcoming[0].packages[0].description} />
        </div>
      </section>

      {upcoming.slice(1).map((group, index) => (
        <section key={group.line} aria-labelledby={`package-${group.line.toLowerCase()}`}>
          <p className="text-xs font-semibold tracking-[0.16em] text-neutral-400">0{index + 2} / {group.line}</p>
          <h2 id={`package-${group.line.toLowerCase()}`} className="mt-1 text-xl font-bold text-neutral-600">{group.line === "CLASS" ? "クラスパッケージ" : "ビジネスパッケージ"}</h2>
          <p className="mt-2 mb-4 text-sm text-neutral-400">{group.caption} — 商品構成を準備しています。</p>
          <div className="grid gap-4 md:grid-cols-3">
            {group.packages.map((item) => <AvailabilityCard key={item.name} {...item} />)}
          </div>
        </section>
      ))}

      <section aria-label="ALL ACCESS（準備中）" className="rounded-2xl border border-neutral-200 bg-neutral-100 px-5 py-6 text-neutral-500">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">PARARI ALL ACCESS</h2>
            <p className="mt-1 text-xs leading-6 text-neutral-400">複数パッケージをまとめて使うための統合商品。内容と料金は検討中です。</p>
          </div>
          <span className="rounded-full border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-400">準備中・申込不可</span>
        </div>
      </section>

      <p className="text-xs leading-6 text-neutral-500">
        既存の有料契約の料金は、請求管理でご確認いただけます。
      </p>
    </div>
  );
}
