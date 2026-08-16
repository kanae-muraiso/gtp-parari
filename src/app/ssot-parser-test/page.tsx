// apps/tools/parari/src/app/ssot-parser-test/page.tsx
// apps/tools/parari/src/app/ssot-parser-test/page.tsx
// 2026-06-21 15:40 JST
// SSOTパーサー＋レンダラー動作確認用の一時ページ

import { parseSsotBlocks } from "@/lib/parari/parseSsotBlocks";
import { SsotBlockRenderer } from "@/components/parari/reader/SsotBlockRenderer";

const sampleSsot = `[PAGE]ZUMBA体験会のお知らせ

金曜日の夜に、初心者向けのZUMBAクラスを行っています。

[NOTICE]ご注意
当日は室内履きをご持参ください。

[LIST:info]参加前の確認
- 初めての方も歓迎です
- 動きやすい服装でお越しください
- 途中参加・途中退出も可能です

[ACCORDION]初めてでも参加できますか？
はい、初心者の方も歓迎です。

動きがわからなくても大丈夫です。

[ACCORDION:warning]キャンセルできますか？
できるだけ早めにご連絡ください。


[BUTTON:success]参加申込はこちら | https://example.com/apply

[LINKS]
LINE | https://line.me/xxxx
Instagram | https://instagram.com/xxxx
ホームページ | https://example.com

[PROFILE]村磯 鼎
日本で一番下手なZUMBAインストラクター。
でも、なぜか参加者は少しずつ上手くなります。
`;

export default function SsotParserTestPage() {
  const blocks = parseSsotBlocks(sampleSsot);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-xl font-bold">
        SSOT Parser Test
      </h1>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-neutral-500">
          Rich UI Preview
        </h2>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <SsotBlockRenderer text={sampleSsot} rich={true} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-neutral-500">
          Plain UI Preview
        </h2>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <SsotBlockRenderer text={sampleSsot} rich={false} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-neutral-500">
          Original SSOT
        </h2>

        <pre className="whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-6">
          {sampleSsot}
        </pre>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-500">
          Parsed Blocks
        </h2>

        <pre className="whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-900 p-4 text-xs leading-6 text-neutral-50">
          {JSON.stringify(blocks, null, 2)}
        </pre>
      </section>
    </main>
  );
}
