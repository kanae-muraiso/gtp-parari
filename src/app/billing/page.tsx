// PARARI subscriptions: public-facing WRITERS A/B product names map to legacy Free/Plus.
// Existing Stripe price IDs and all active billing records remain unchanged.
import Link from "next/link";
import BillingPortalButton from "@/components/parari/billing/BillingPortalButton";
import CurrentPlanPanel from "@/components/parari/billing/CurrentPlanPanel";
import PackageStore from "@/components/parari/billing/PackageStore";
import ParariLegalFooter from "@/components/parari/ParariLegalFooter";
import SettingsTabs from "@/components/parari/settings/SettingsTabs";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import ManagementTabs from "@/components/parari/navigation/ManagementTabs";

export default function BillingPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="設定" showManagementLinks={false} area="settings" />
        <div className="mt-6"><ManagementTabs active="settings" /></div>
        <div className="mx-auto mt-4 max-w-5xl">
          <SettingsTabs active="plan" />

          <header className="mt-6 rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold tracking-[0.18em] text-neutral-400">PACKAGES & BILLING</p>
            <h1 className="mt-2 text-2xl font-bold text-neutral-950">パッケージとお支払い</h1>
            <p className="mt-3 text-sm leading-7 text-neutral-600">
              現在のFreeプランはWRITERS A、PlusプランはWRITERS Bとしてご案内します。
              内部の契約・権限とStripeの課金設定は変更していません。
            </p>
            <Link href="/packages" className="mt-3 inline-block text-sm font-semibold text-sky-800 underline underline-offset-4">
              ログイン不要のパッケージ一覧を見る
            </Link>
          </header>

          <div className="mt-6"><CurrentPlanPanel /></div>

          <div className="mt-10"><PackageStore /></div>

          <section className="mt-10 rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8">
            <p className="text-xs font-bold tracking-[0.16em] text-neutral-400">CUSTOMER PORTAL</p>
            <h2 className="mt-2 text-xl font-bold text-neutral-950">請求管理</h2>
            <p className="mt-3 text-sm leading-7 text-neutral-600">
              カード情報の変更、請求履歴、有料契約の解約はStripeの管理画面から行えます。
              既存のOrganizer・Host・Pro契約をお持ちの方も引き続き請求管理をご利用いただけます。
            </p>
            <div className="mt-5 max-w-sm"><BillingPortalButton /></div>
          </section>

          <p className="mt-8 text-center text-xs leading-6 text-neutral-500">
            決済情報はStripeが管理します。PARARIがカード番号を保存することはありません。
          </p>
          <div className="mt-5"><ParariLegalFooter /></div>
        </div>
      </div>
    </main>
  );
}
