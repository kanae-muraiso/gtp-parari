"use client";

import type {
  ApplicationPaymentMethod,
} from "./applicationManagerSupport";

type FreeApplicationLiteSettingsProps = {
  actionLabel: string;
  onActionLabelChange: (value: string) => void;
  paymentMethod: ApplicationPaymentMethod;
  onPaymentMethodChange: (
    value: ApplicationPaymentMethod,
  ) => void;
  paymentAmount: string;
  onPaymentAmountChange: (value: string) => void;
};

export default function FreeApplicationLiteSettings({
  actionLabel,
  onActionLabelChange,
  paymentMethod,
  onPaymentMethodChange,
  paymentAmount,
  onPaymentAmountChange,
}: FreeApplicationLiteSettingsProps) {
  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="rounded-xl bg-white px-3 py-2 text-xs font-bold leading-6 text-neutral-700">
        FREEではAPPLICATIONは1つまで作成できます。申込者は10名までです。
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-bold text-neutral-900">
          ボタンの文字
        </span>
        <input
          type="text"
          value={actionLabel}
          onChange={(event) =>
            onActionLabelChange(
              event.target.value,
            )
          }
          placeholder="例）資料を請求する"
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
        />
      </label>

      <div className="mt-5 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="text-sm font-bold text-neutral-900">
          支払
        </div>

        <select
          value={paymentMethod}
          onChange={(event) =>
            onPaymentMethodChange(
              event.target.value as ApplicationPaymentMethod,
            )
          }
          className="mt-3 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
        >
          <option value="none">無料</option>
          <option value="parari">
            PARARI決済（Square）
          </option>
        </select>

        {paymentMethod === "parari" ? (
          <div className="mt-4">
            <label className="block text-xs font-bold text-neutral-600">
              参加費
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={paymentAmount}
                onChange={(event) =>
                  onPaymentAmountChange(
                    event.target.value,
                  )
                }
                placeholder="500"
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
              />
              <span className="shrink-0 text-sm text-neutral-500">
                円
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-neutral-500">
              申込者はSquareの安全な決済画面で支払います。
              PARARIがカード番号を保存することはありません。
            </p>
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-xs leading-6 text-neutral-500">
        FREEでは、ボタンを押した人のお名前と確認済みメールアドレスを受け取ります。
        PARARI未登録の方にはメール確認が自動で入ります。
      </p>
    </div>
  );
}
