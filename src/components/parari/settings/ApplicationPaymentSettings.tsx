"use client";

import * as React from "react";

export type ApplicationPaymentMethod =
  | "none"
  | "on_site"
  | "bank_transfer"
  | "payment_link";

type Props = {
  paymentMethod: ApplicationPaymentMethod;
  onPaymentMethodChange: (
    method: ApplicationPaymentMethod,
  ) => void;
  paymentAmount: string;
  onPaymentAmountChange: (value: string) => void;
  paymentUrl: string;
  onPaymentUrlChange: (value: string) => void;
  paymentInstructions: string;
  onPaymentInstructionsChange: (value: string) => void;
  paymentConfirmationRequired: boolean;
  onPaymentConfirmationRequiredChange: (
    value: boolean,
  ) => void;
  hasCalendarBlock: boolean;
};

export default function ApplicationPaymentSettings({
  paymentMethod,
  onPaymentMethodChange,
  paymentAmount,
  onPaymentAmountChange,
  paymentUrl,
  onPaymentUrlChange,
  paymentInstructions,
  onPaymentInstructionsChange,
  paymentConfirmationRequired,
  onPaymentConfirmationRequiredChange,
  hasCalendarBlock,
}: Props) {
  const isLegacyPaymentMethod =
    paymentMethod === "bank_transfer" ||
    paymentMethod === "payment_link";

  const paymentMethodCardClass = (
    selected: boolean,
  ) =>
    selected
      ? "rounded-2xl border border-neutral-900 bg-neutral-50 p-4"
      : "rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-400";

  return (
    <div className="mt-5 rounded-2xl border border-neutral-200 p-5">
      <div className="text-sm font-bold text-neutral-950">
        参加費・支払
      </div>

      <p className="mt-1 text-xs leading-5 text-neutral-500">
        参加者から料金を受け取る方法を選びます。
        PARARI決済はSquare接続後に利用できるようになります。
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label
          className={paymentMethodCardClass(
            paymentMethod === "none",
          )}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="application-payment-method"
              checked={paymentMethod === "none"}
              onChange={() => {
                onPaymentMethodChange("none");
                onPaymentConfirmationRequiredChange(false);
              }}
              className="mt-1"
            />

            <span>
              <span className="block text-sm font-bold text-neutral-900">
                無料
              </span>
              <span className="mt-1 block text-xs leading-5 text-neutral-500">
                参加費を受け取りません。
              </span>
            </span>
          </div>
        </label>

        <label
          className={paymentMethodCardClass(
            paymentMethod === "on_site",
          )}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="application-payment-method"
              checked={paymentMethod === "on_site"}
              onChange={() => {
                onPaymentMethodChange("on_site");
                onPaymentUrlChange("");
                onPaymentConfirmationRequiredChange(false);
              }}
              className="mt-1"
            />

            <span>
              <span className="block text-sm font-bold text-neutral-900">
                現地払い
              </span>
              <span className="mt-1 block text-xs leading-5 text-neutral-500">
                会場などで主催者が受け取ります。
              </span>
            </span>
          </div>
        </label>

        <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4 opacity-70">
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="application-payment-method"
              disabled
              className="mt-1"
            />

            <span>
              <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-neutral-700">
                PARARI決済
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-400">
                  準備中
                </span>
              </span>
              <span className="mt-1 block text-xs leading-5 text-neutral-400">
                PARARI上で支払います。
              </span>
            </span>
          </div>
        </div>
      </div>

      {isLegacyPaymentMethod ? (
        <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-3">
          <div className="text-xs font-bold text-neutral-700">
            旧設定：
            {paymentMethod === "bank_transfer"
              ? "銀行振込"
              : "外部支払リンク"}
          </div>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            既存APPLICATIONとの互換性のため、この設定はそのまま保存できます。
            新方式へ変更する場合は「無料」または「現地払い」を選んでください。
          </p>
        </div>
      ) : null}

      {hasCalendarBlock ? (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <div className="text-xs font-bold text-neutral-800">
            料金は各開催回で設定します
          </div>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            CALENDARに設定した開催回の料金が、申込時の正式価格になります。
            APPLICATION側では金額を重ねて設定しません。
          </p>
          {paymentMethod === "none" ? (
            <p className="mt-2 text-xs leading-5 text-neutral-500">
              無料で受け付ける場合は、CALENDAR側の開催回料金も0円にしてください。
            </p>
          ) : null}
        </div>
      ) : paymentMethod !== "none" ? (
        <div className="mt-4">
          <label className="block text-xs font-bold text-neutral-600">
            参加費
          </label>

          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={paymentAmount}
              onChange={(event) =>
                onPaymentAmountChange(event.target.value)
              }
              placeholder="3000"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
            />

            <span className="shrink-0 text-sm text-neutral-500">
              円
            </span>
          </div>
        </div>
      ) : null}

      {paymentMethod === "payment_link" ? (
        <div className="mt-4">
          <label className="block text-xs font-bold text-neutral-600">
            支払リンク
          </label>

          <input
            type="url"
            value={paymentUrl}
            onChange={(event) =>
              onPaymentUrlChange(event.target.value)
            }
            placeholder="https://..."
            className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
          />
        </div>
      ) : null}

      {paymentMethod !== "none" ? (
        <div className="mt-4">
          <label className="block text-xs font-bold text-neutral-600">
            {paymentMethod === "on_site"
              ? "現地での支払案内"
              : paymentMethod === "bank_transfer"
                ? "振込案内（旧設定）"
                : "支払についての案内（旧設定）"}
          </label>

          <textarea
            value={paymentInstructions}
            onChange={(event) =>
              onPaymentInstructionsChange(
                event.target.value,
              )
            }
            rows={3}
            placeholder={
              paymentMethod === "on_site"
                ? "例）当日受付で現金でお支払いください。"
                : paymentMethod === "bank_transfer"
                  ? "例）振込先、振込期限などを入力してください。"
                  : "必要な案内があれば入力してください。"
            }
            className="mt-2 w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-7 outline-none focus:border-neutral-600"
          />
        </div>
      ) : null}

      {isLegacyPaymentMethod ? (
        <label className="mt-5 flex items-start gap-3 rounded-xl bg-neutral-50 p-4">
          <input
            type="checkbox"
            checked={paymentConfirmationRequired}
            onChange={(event) =>
              onPaymentConfirmationRequiredChange(
                event.target.checked,
              )
            }
            className="mt-1"
          />

          <span>
            <span className="block text-sm font-bold text-neutral-900">
              支払確認後に参加確定とする
            </span>
            <span className="mt-1 block text-xs leading-5 text-neutral-500">
              旧方式の支払確認設定です。
            </span>
          </span>
        </label>
      ) : null}
    </div>
  );
}
