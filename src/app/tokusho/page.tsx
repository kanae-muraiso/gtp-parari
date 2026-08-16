// src/app/tokusho/page.tsx
// PARARI 特定商取引法に基づく表記 簡易ひな形
// 公開前に [ ] 内の情報と、実際の販売条件を必ず確認・修正してください。
// 免責条項等は、必要に応じて専門家の確認を受けてください。

import type { ReactNode } from "react";

const LAST_UPDATED = "2026年7月12日";

type RowProps = {
  label: string;
  children: ReactNode;
};

function Row({ label, children }: RowProps) {
  return (
    <div className="grid gap-2 border-b border-neutral-200 py-4 sm:grid-cols-[180px_minmax(0,1fr)]">
      <dt className="text-sm font-bold text-neutral-900">{label}</dt>
      <dd className="text-sm leading-7 text-neutral-700">{children}</dd>
    </div>
  );
}

export default function TokushoPage() {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 text-neutral-900">
      <article className="mx-auto w-full max-w-3xl rounded-3xl bg-white p-6 shadow-sm sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-neutral-400">
              COMMERCIAL TRANSACTIONS
            </p>

            <h1 className="mt-2 text-2xl font-bold">
              特定商取引法に基づく表記
            </h1>
          </div>

          <a
            href="/billing"
            className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-200"
          >
            プランとお支払いへ戻る
          </a>
        </div>

          {/*
          <p className="mt-6 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
            このページは簡易ひな形です。[ ] 内の情報と、返金・解約条件等を
            実際の運営内容に合わせて書き換えてください。
          </p>
          */}
          
          <dl className="mt-6 border-t border-neutral-200">
            <Row label="販売事業者">合同会社シーピーピー</Row>

            <Row label="運営責任者">村磯鼎</Row>

            <Row label="所在地">京都市中京区布袋屋町491-304</Row>

            <Row label="お問い合わせ">
            parari_at_cpp.co.jp
            </Row>

          <Row label="販売価格">
            PARARI Plus：月額5米ドル
            <br />
            実際の請求額は、申込画面およびStripeの決済画面に表示されます。
          </Row>

          <Row label="販売価格以外の費用">
            インターネット接続に必要な通信料金は、利用者の負担となります。
            また、カード会社等による為替換算手数料や海外事務手数料が
            発生する場合があります。
          </Row>

          <Row label="支払方法">
            クレジットカード決済（Stripe）
          </Row>

          <Row label="支払時期">
            申込時に初回料金が決済され、その後は毎月の自動更新時に
            決済されます。
          </Row>

          <Row label="サービス提供時期">
            決済が完了し、Plusプランが有効になり次第利用できます。
          </Row>

          <Row label="契約期間・自動更新">
            契約期間は1か月単位です。利用者が解約手続きを行わない限り、
            毎月自動的に更新されます。
          </Row>

          <Row label="解約方法">
            PARARIの「プランとお支払い」ページから請求管理画面を開き、
            Stripe Customer Portalで解約手続きを行います。
            解約手続き後の利用終了日は、請求管理画面に表示されます。
          </Row>

          <Row label="返金・キャンセル">
            契約期間中は、請求管理画面からいつでも解約手続きを行うことができます。
            解約手続き後も、請求管理画面に表示される利用終了日までは
            Plusプランを利用できます。
            <br />
            <br />
            利用者の都合による解約について、すでに支払われた利用料金の
            日割り計算による返金、その他の返金は行いません。
            ただし、法令により返金が必要となる場合は、この限りではありません。
          </Row>

          <Row label="サービスの中断・免責">
            天災地変、通信回線の障害、クラウドサービス、決済事業者その他の
            第三者サービスの障害、定期または緊急の保守その他、
            当方の合理的な支配を超える事由により、本サービスの全部または一部が
            一時的に利用できなくなる場合があります。
            <br />
            <br />
            当方の責めに帰すことのできない事由によって生じたサービスの中断について、
            当方は返金または損害賠償の責任を負いません。
            <br />
            <br />
            当方の軽過失により利用者に損害が生じた場合、
            当方の損害賠償責任は、当該損害が発生した月に利用者が
            当方へ支払った利用料金を上限とします。
            ただし、当方の故意または重大な過失による場合、
            利用者の生命または身体に生じた損害の場合、
            その他法令上この制限が認められない場合は、この限りではありません。
          </Row>

          <Row label="動作環境">
            インターネットへ接続できる環境と、PARARIが対応する
            最新版のWebブラウザが必要です。
          </Row>
        </dl>

        <p className="mt-8 text-xs leading-6 text-neutral-500">
          最終更新：{LAST_UPDATED}
        </p>
      </article>
    </main>
  );
}
