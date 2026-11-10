"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

import { EpubExportButton } from "@/components/parari/EpubExportButton";
import { buildBookSheets } from "@/components/parari/viewer-v2/book/buildBookSheets";

type Props = {
  workId: string;
  title: string;
  content: string;
  editHref: string;
  viewHref: string;
};

const linkClass = "font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900";
const kdpUrl = "https://kdp.amazon.co.jp/";

export function KindlePublishingGuide({ workId, title, content, editHref, viewHref }: Props) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [exportMessage, setExportMessage] = useState("");
  const { author, coverImage } = buildBookSheets(content);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby={headingId} className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
      <h3 ref={headingRef} id={headingId} tabIndex={-1} className="text-base font-bold text-neutral-950">
        Kindle出版の準備
      </h3>
      <p className="mt-1 break-words text-sm text-neutral-600">{title}</p>

      <ol className="mt-4 list-decimal space-y-4 pl-5 text-sm marker:font-bold">
        <li className="pl-1">
          <h4 className="font-bold">出版前に確認する</h4>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-neutral-700">
            <dt className="font-semibold">表紙画像</dt>
            <dd>{coverImage ? "設定済み。KDPにアップロードする画像ファイルを手元に用意します。" : "未設定。KDP用の表紙画像を用意します。"}</dd>
            <dt className="font-semibold">著者名</dt>
            <dd className="break-words">{author || "未設定"}</dd>
            <dt className="font-semibold">目次</dt>
            <dd>章やページの順序と見出しを確認してください。</dd>
          </dl>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            <Link href={editHref} prefetch={false} className={linkClass}>BOOKを編集</Link>
            <Link href={viewHref} prefetch={false} target="_blank" rel="noreferrer" className={linkClass}>
              BOOKの表示を確認（別タブ）
            </Link>
          </div>
        </li>
        <li className="pl-1">
          <h4 className="font-bold">EPUBを書き出す</h4>
          <p className="mb-2 mt-1 text-neutral-700">保存済みのBOOKを、Kindleにアップロードする原稿としてダウンロードします。</p>
          <EpubExportButton
            workId={workId}
            title={title}
            label="EPUBをダウンロード"
            getBlockedReason={() => ""}
            onMessage={setExportMessage}
          />
          <div role="status" className={exportMessage ? "mt-2 whitespace-pre-wrap rounded-xl bg-violet-50 p-3 text-violet-900" : "sr-only"}>
            {exportMessage}
          </div>
        </li>
        <li className="pl-1">
          <h4 className="font-bold">Amazon KDPで出版手続きをする</h4>
          <details className="my-2 rounded-xl border border-neutral-200 bg-white p-3 text-neutral-700">
            <summary className="cursor-pointer font-semibold">初回設定がまだの方・途中の方</summary>
            <p className="mt-2">
              開く前に、正式な氏名・住所・電話番号、振込先の銀行名・支店コード・口座番号・名義を手元に用意します。口座情報は銀行アプリや通帳で確認できます。
              2段階認証に使う端末と、本人確認に備えて運転免許証やパスポートも手元に置いておくと進めやすくなります。
            </p>
            <p className="mt-2">
              日本が税務上の居住国で、日本の納税者番号を使う場合は、個人ならマイナンバーカード裏面の12桁、法人なら法人番号13桁を用意します。
              法人番号は<a href="https://www.houjin-bangou.nta.go.jp/" target="_blank" rel="noopener noreferrer" className={linkClass}>国税庁のサイト（別タブ）</a>で確認できます。
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>下のボタンからKDPを開き、サインインします。画面上部の「アカウント」を押します。</li>
              <li>基本情報と「支払いの受け取り方法」を入力します。本人確認を求められたら、画面の指示に沿って身分証を提出します。</li>
              <li>「税務情報」を開きます。初回は税務プロファイルの作成に進み、登録内容を確認・修正する場合は「税務プロファイルの更新/確認」を押します。日本の番号を使う場合は、米国以外の納税者番号の欄に入力します。KDPで「完了」と表示されたら、この手順は済んでいます。</li>
            </ol>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              <a href="https://kdp.amazon.co.jp/ja_JP/help/topic/GCAMZS55VGYBQVEG" target="_blank" rel="noopener noreferrer" className={linkClass}>サインインできない場合（別タブ）</a>
              <a href="https://kdp.amazon.co.jp/ja_JP/help/topic/G201723290" target="_blank" rel="noopener noreferrer" className={linkClass}>米国の納税者番号など、税務の詳細（別タブ）</a>
            </div>
          </details>
          <p className="mb-2 text-neutral-700">
            設定済みの方は、KDPの「本棚」→「＋ 作成」から電子書籍を選びます。書名・著者名・内容紹介を入力し、EPUB原稿と表紙をアップロードします。プレビューを確認して価格を設定し、出版を申請します。
          </p>
          <a href={kdpUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            KDPの操作画面を開く（別タブ）
          </a>
        </li>
      </ol>
    </section>
  );
}
