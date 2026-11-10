// 2026/11/10 JST
// PART: Guide first-time sellers through Square registration and back to PARARI.

import Link from "next/link";

const officialGuide = "https://squareup.com/jp/ja/townsquare/create-account";
const reviewGuide = "https://squareup.com/help/jp/ja/article/5682-account-on-boarding-assessment-faqs";
const signupUrl = "https://app.squareup.com/signup/ja-jp";

export default function SquareRegistrationGuide() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 text-neutral-950">
      <div className="mx-auto max-w-2xl">
        <Link href="/my/settings#sell-work" className="text-sm font-semibold text-sky-800 underline underline-offset-4">
          販売の設定へ戻る
        </Link>

        <article className="mt-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold">初めてSquareを使う方へ</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Squareで決済と振込の準備を済ませてから、PARARIに接続します。
          </p>

          <ol className="mt-6 list-decimal space-y-6 pl-5 text-sm leading-6 text-neutral-700">
            <li className="pl-1">
              <h2 className="font-bold text-neutral-950">登録に使う情報を用意する</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><strong>個人・個人事業主</strong>は、本人情報、事業内容、振込先口座をご用意ください。本人確認を求められたときは、運転免許証などをSquareの画面で提出します。</li>
                <li><strong>法人</strong>は、13桁の法人番号、登記と一致する事業者情報、代表者情報、振込先口座をご用意ください。</li>
              </ul>
              <p className="mt-2">
                追加審査では、個人事業主は開業届や事業内容が分かる広告など、法人は発行から6か月以内の登記簿謄本を求められる場合があります。
              </p>
              <a className="font-semibold text-sky-800 underline underline-offset-4" href={reviewGuide} target="_blank" rel="noopener noreferrer">
                Square公式の申込審査FAQ（別タブ）
              </a>
            </li>

            <li className="pl-1">
              <h2 className="font-bold text-neutral-950">Squareでアカウントを作り、口座まで登録する</h2>
              <p>
                メールアドレスとパスワードを登録したあと、事業者情報と売上の振込先口座まで入力します。初めて作品を売る場合は、たとえば「自作の電子書籍をPARARIで販売し、購入者がオンラインで読みます」と販売内容を説明できます。
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <a className="rounded-xl bg-neutral-900 px-4 py-2 font-semibold text-white" href={signupUrl} target="_blank" rel="noopener noreferrer">
                  Squareアカウントを作る（別タブ）
                </a>
                <a className="font-semibold text-sky-800 underline underline-offset-4" href={officialGuide} target="_blank" rel="noopener noreferrer">
                  Square公式の登録手順・画面例（別タブ）
                </a>
              </div>
            </li>

            <li className="pl-1">
              <h2 className="font-bold text-neutral-950">決済と振込の準備ができたことを確認する</h2>
              <p>
                Squareから届くカード決済の審査結果と、銀行口座の認証結果を確認します。追加資料の案内が届いた場合は、Squareで手続きします。
              </p>
            </li>

            <li className="pl-1">
              <h2 className="font-bold text-neutral-950">PARARIに戻ってSquareを接続する</h2>
              <p>
                カード決済の承認と口座の認証を確認したら、PARARIで「Squareを接続」を押し、Squareの画面で連携を許可します。「Square接続済み」になったら、販売する作品を選んで価格を設定できます。
              </p>
              <Link className="mt-2 inline-block font-semibold text-sky-800 underline underline-offset-4" href="/my/settings#sell-work">
                PARARIのSquare接続を開く
              </Link>
            </li>
          </ol>
        </article>
      </div>
    </main>
  );
}
