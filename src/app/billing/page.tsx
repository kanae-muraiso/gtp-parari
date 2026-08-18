// src/app/billing/page.tsx
// 2026-07-11 JST

import BillingPortalButton from "@/components/parari/billing/BillingPortalButton";
import CurrentPlanPanel from "@/components/parari/billing/CurrentPlanPanel";
import PlusCheckoutButton from "@/components/parari/billing/PlusCheckoutButton";
import ParariLegalFooter from "@/components/parari/ParariLegalFooter";
import SettingsTabs from "@/components/parari/settings/SettingsTabs";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import ManagementTabs from "@/components/parari/navigation/ManagementTabs";

function LimitItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm leading-6 text-slate-700">
      <span
        aria-hidden="true"
        className="mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-400"
      />
      <span>{children}</span>
    </li>
  );
}

export default function BillingPage() {
    return (
      <main className="min-h-screen bg-neutral-50 text-slate-900">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          {/* HEADER */}
          <MyAreaHeader
            title="設定"
            showManagementLinks={false}
          />

          {/* MANAGEMENT MAIN MENU */}
          <div className="mt-6">
            <ManagementTabs active="settings" />
          </div>

          {/* SETTINGS */}
          <div className="mx-auto mt-4 max-w-4xl">
            <SettingsTabs active="plan" />

            <div className="mt-6 flex flex-col gap-6">
              <header className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
                <p className="text-xs font-semibold tracking-[0.2em] text-slate-400">
                  PLAN & BILLING
                </p>

                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                  プランとお支払い
                </h2>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                  現在のプラン確認、Plusへの申込、カード情報の変更や解約を
                  このページから行えます。
                </p>
              </header>

              <CurrentPlanPanel />

        <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">
              PLAN COMPARISON
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              FreeとPlus
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-600">
              PARARIはFreeから始められます。作品数やページ数を増やしたい場合は、
              月額5ドルのPlusをご利用ください。
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold text-slate-500">
                Free
              </p>

              <p className="mt-2 text-3xl font-bold text-slate-950">
                $0
              </p>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                PARARIの基本機能を無料で利用できます。
              </p>

              <ul className="mt-6 space-y-3">
                <LimitItem>
                  作品作成：10作品まで
                </LimitItem>
                <LimitItem>
                  公開作品：3作品まで
                </LimitItem>
                <LimitItem>
                  1作品：10ページまで
                </LimitItem>
              </ul>
            </article>

            <article className="rounded-3xl border-2 border-slate-900 bg-slate-950 p-6 text-white shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-300">
                    Plus
                  </p>

                  <p className="mt-2 text-3xl font-bold">
                    $5
                    <span className="ml-1 text-sm font-medium text-slate-300">
                      / month
                    </span>
                  </p>
                </div>

                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-950">
                  おすすめ
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                日常的な作品制作と公開に使えるプランです。
              </p>

              <ul className="mt-6 space-y-3">
                <li className="flex gap-3 text-sm leading-6 text-slate-100">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-white"
                  />
                  <span>作品作成：100作品まで</span>
                </li>

                <li className="flex gap-3 text-sm leading-6 text-slate-100">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-white"
                  />
                  <span>公開作品：100作品まで</span>
                </li>

                <li className="flex gap-3 text-sm leading-6 text-slate-100">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-white"
                  />
                  <span>1作品：100ページまで</span>
                </li>

                <li className="flex gap-3 text-sm leading-6 text-slate-100">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-white"
                  />
                  <span>保存容量には上限があります</span>
                </li>
              </ul>

              <div className="mt-7">
                <PlusCheckoutButton />
              </div>
            </article>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">
            CUSTOMER PORTAL
          </p>

          <h2 className="mt-1 text-xl font-bold text-slate-950">
            請求管理
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            カード情報の変更、請求履歴の確認、Plusの解約は、
            Stripeの安全な管理画面で行います。
          </p>

          <p className="mt-2 text-xs leading-6 text-slate-500">
            請求管理は、Plusをご契約中、または過去にPlusへお申し込み済みの場合に利用できます。
            未契約の場合、請求管理画面は表示されません。
          </p>

          <div className="mt-5 max-w-sm">
            <BillingPortalButton />
          </div>
        </section>

        <div>
          <p className="px-2 text-center text-xs leading-6 text-slate-500">
            決済情報はStripeが管理します。PARARIがカード番号を保存することはありません。
          </p>

          <ParariLegalFooter />
        </div>
      </div>
    </div>
    </div>
    </main>
  );
}
