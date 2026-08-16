// src/app/privacy/page.tsx
// PARARI プライバシーポリシー簡易ひな形
// 公開前に [ ] 内の情報を実際の内容へ書き換えてください。

const LAST_UPDATED = "2026年7月12日";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-neutral-950">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-neutral-700">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 text-neutral-900">
      <article className="mx-auto w-full max-w-3xl rounded-3xl bg-white p-6 shadow-sm sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-neutral-400">
              PRIVACY POLICY
            </p>
            <h1 className="mt-2 text-2xl font-bold">
              プライバシーポリシー
            </h1>
          </div>

          <a
            href="/"
            className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-200"
          >
            PARARIへ戻る
          </a>
        </div>

        <p className="mt-6 text-sm leading-7 text-neutral-700">
          [運営者名]（以下「運営者」といいます。）は、PARARI（以下「本サービス」といいます。）
          における利用者情報を、以下の方針に基づいて取り扱います。
        </p>

        <div className="mt-8 space-y-8">
          <Section title="1. 取得する情報">
            <p>運営者は、本サービスの提供にあたり、次の情報を取得することがあります。</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>メールアドレス、ユーザー名、表示名などの登録情報</li>
              <li>利用者が作成・保存・公開する作品、プロフィールその他の入力情報</li>
              <li>契約プラン、決済状況、Stripe Customer IDなどの請求管理情報</li>
              <li>IPアドレス、ブラウザ情報、アクセス日時、Cookieなどの利用情報</li>
              <li>お問い合わせの際に提供される情報</li>
            </ul>
            <p>
              クレジットカード番号等の決済情報はStripeが管理し、
              PARARIはカード番号を保存しません。
            </p>
          </Section>

          <Section title="2. 利用目的">
            <ul className="list-disc space-y-2 pl-5">
              <li>本サービスの提供、本人確認、ログイン機能の提供のため</li>
              <li>作品の保存、公開、共有その他の機能を提供するため</li>
              <li>料金の請求、契約状況の確認、解約等の請求管理のため</li>
              <li>お問い合わせへの対応、重要なお知らせの送信のため</li>
              <li>不正利用の防止、障害対応、安全性の確保のため</li>
              <li>サービスの改善および利用状況の分析のため</li>
            </ul>
          </Section>

          <Section title="3. 外部サービスの利用">
            <p>
              本サービスでは、認証・データ保存、決済、ホスティング等のために、
              Supabase、Stripe、Vercelその他の外部サービスを利用することがあります。
              これらの事業者に必要な範囲で情報が送信・保存される場合があります。
            </p>
          </Section>

          <Section title="4. 第三者提供">
            <p>
              運営者は、法令に基づく場合、本人の同意がある場合、
              または本サービスの提供に必要な業務委託先へ提供する場合を除き、
              個人情報を第三者へ提供しません。
            </p>
          </Section>

          <Section title="5. 情報の管理">
            <p>
              運営者は、取得した情報の漏えい、滅失、改ざん、不正アクセス等を防止するため、
              必要かつ適切な安全管理措置を講じます。
            </p>
          </Section>

          <Section title="6. 開示・訂正・削除等">
            <p>
              利用者本人から、保有個人データの開示、訂正、利用停止、削除等の請求があった場合、
              本人確認を行ったうえで、法令に従って対応します。
            </p>
          </Section>

          <Section title="7. Cookie等">
            <p>
              本サービスは、ログイン状態の維持、利便性の向上、利用状況の把握等のために、
              Cookieまたはこれに類する技術を利用することがあります。
            </p>
          </Section>

          <Section title="8. 本ポリシーの変更">
            <p>
              運営者は、法令や本サービスの内容の変更等に応じて、
              本ポリシーを改定することがあります。
              重要な変更がある場合は、本サービス上でお知らせします。
            </p>
          </Section>

          <Section title="9. お問い合わせ">
            <p>運営者名：合同会社シーピーピー</p>
            <p>連絡先：parari_at_cpp.co.jp</p>
          </Section>
        </div>

        <p className="mt-10 border-t border-neutral-200 pt-5 text-xs text-neutral-500">
          制定・最終更新：{LAST_UPDATED}
        </p>
      </article>
    </main>
  );
}
