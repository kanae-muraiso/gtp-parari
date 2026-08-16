// src/app/dev/ssot-lab/page.tsx
// 2026-06-29 00:05 JST
// PART: SSOT Lab
// コメント:
// - DB保存なしでSSOTを直接貼り付けて、PagePanelComposerの解釈を確認する開発用入口
// - [BOOK] / [PAGE] が BOOKINFO / PAGEINFO パネルとして表示されるか確認する
// - 旧BOOK SSOTやPARARI SSOT v2変換の実験に使う

"use client";

import { useMemo, useState } from "react";
import { PagePanelComposer } from "@/components/parari/mvp/PagePanelComposer";
import { parseBlocks } from "@/lib/parari/ssot-v2/parseBlocks";
import { serializeBlocks } from "@/lib/parari/ssot-v2/serializeBlocks";

const SAMPLE_SSOT = `[BOOK]
title: サンプルBOOK
author: 青山太郎

[PAGE]
title: 1ページ目
mainImage:

[IMAGE]
https://example.com/sample.jpg

[T]
ここに本文を書きます。

[PAGE]
title: 2ページ目
mainImage:

[T]
2ページ目の本文です。`;

export default function SsotLabPage() {
  const [inputSsot, setInputSsot] = useState(SAMPLE_SSOT);
  const [composerSsot, setComposerSsot] = useState(SAMPLE_SSOT);

  const parsedBlocks = useMemo(() => parseBlocks(composerSsot), [composerSsot]);
  const serialized = useMemo(
    () => serializeBlocks(parsedBlocks),
    [parsedBlocks],
  );

  const applyInputToComposer = () => {
    setComposerSsot(inputSsot);
  };

  const copySerialized = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    void navigator.clipboard.writeText(serialized);
  };

  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold text-neutral-400">
            /dev/ssot-lab
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
            PARARI SSOT Lab
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            SSOTを直接貼り付けて、パネル列としてどう解釈されるか確認する開発用ページです。
            DBには保存しません。
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <section className="space-y-4">
            <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-neutral-500">
                    入力SSOT
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-neutral-400">
                    旧BOOKや新SSOTをここに貼り付けます。
                  </div>
                </div>

                <button
                  type="button"
                  onClick={applyInputToComposer}
                  className="rounded-full bg-neutral-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-neutral-700"
                >
                  パネルに反映
                </button>
              </div>

              <textarea
                value={inputSsot}
                onChange={(event) => setInputSsot(event.target.value)}
                spellCheck={false}
                className="min-h-[420px] w-full resize-y rounded-2xl border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs leading-5 text-neutral-800 outline-none focus:border-neutral-400"
              />
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-neutral-500">
                    正規化SSOT
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-neutral-400">
                    parseBlocks → serializeBlocks の結果です。
                  </div>
                </div>

                <button
                  type="button"
                  onClick={copySerialized}
                  className="rounded-full bg-white px-3 py-2 text-xs font-bold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
                >
                  コピー
                </button>
              </div>

              <textarea
                value={serialized}
                readOnly
                spellCheck={false}
                className="min-h-[260px] w-full resize-y rounded-2xl border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs leading-5 text-neutral-700"
              />
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <div className="text-xs font-bold text-neutral-500">
                パネル解釈
              </div>
              <div className="mt-1 text-[11px] leading-5 text-neutral-400">
                PagePanelComposerで表示します。BOOK/PAGEが登録済みならBOOKINFO/PAGEINFOとして出ます。
              </div>
            </div>

            <PagePanelComposer
              value={composerSsot}
              onChange={setComposerSsot}
              textPlaceholder="本文"
            />
          </section>
        </div>
      </div>
    </main>
  );
}
