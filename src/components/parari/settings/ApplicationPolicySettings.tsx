"use client";

import type {
  ApplicationAcceptanceMode,
} from "@/components/parari/panels/application/applicationTypes";

import {
  ACTION_LABEL_OPTIONS,
} from "./applicationManagerSupport";
import type {
  ApplicationCancellationMode,
  ApplicationPaymentMethod,
} from "./applicationManagerSupport";

const AGREEMENT_TEMPLATES = {
  EVENT: `本APPLICATIONに記載された内容を確認したうえでお申し込みください。

参加できなくなった場合は、できるだけ早く主催者へご連絡ください。

参加費が設定されている場合は、記載された方法・期限に従ってお支払いください。

入力された情報は、本イベントの受付・運営および必要な連絡のために利用します。`,

  APPLICATION: `入力内容が正確であることを確認してお申し込みください。

応募・申込によって、採用・参加・契約等が保証されるものではありません。

応募・申込内容について、運営者から連絡する場合があります。

入力された情報は、受付・確認・選考および必要な連絡のために利用します。`,

  CONTACT: `お問い合わせに必要な情報を入力してください。

内容によっては回答できない場合や、回答まで時間を要する場合があります。

入力された情報および連絡先は、このお問い合わせへの回答および必要な連絡のために利用します。`,

  MEMBERSHIP: `登録内容を確認したうえでお申し込みください。

Membershipに設定された参加条件・利用条件をご確認ください。

会費等が設定されている場合は、記載された条件に従ってお支払いください。

登録情報は、Membershipの運営および必要な連絡のために利用します。`,
} as const;

type ApplicationPolicySettingsProps = {
  hasCalendarBlock: boolean;
  paymentMethod: ApplicationPaymentMethod;
  onPaymentMethodChange: (
    method: ApplicationPaymentMethod,
  ) => void;
  paymentAmount: string;
  onPaymentAmountChange: (value: string) => void;
  paymentUrl: string;
  onPaymentUrlChange: (value: string) => void;
  paymentInstructions: string;
  onPaymentInstructionsChange: (
    value: string,
  ) => void;
  paymentConfirmationRequired: boolean;
  onPaymentConfirmationRequiredChange: (
    value: boolean,
  ) => void;
  cancellationMode: ApplicationCancellationMode;
  onCancellationModeChange: (value: ApplicationCancellationMode) => void;
  cancellationDeadlineAt: string;
  onCancellationDeadlineAtChange: (value: string) => void;
  cancellationCutoffMinutes: string;
  onCancellationCutoffMinutesChange: (value: string) => void;
  agreement: string;
  onAgreementChange: (value: string) => void;
  acceptanceMode: ApplicationAcceptanceMode;
  onAcceptanceModeChange: (
    mode: ApplicationAcceptanceMode,
  ) => void;
  actionLabelPreset: string;
  onActionLabelPresetChange: (value: string) => void;
  actionLabel: string;
  onActionLabelChange: (value: string) => void;
};

export default function ApplicationPolicySettings({
  hasCalendarBlock,
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
  cancellationMode,
  onCancellationModeChange,
  cancellationDeadlineAt,
  onCancellationDeadlineAtChange,
  cancellationCutoffMinutes,
  onCancellationCutoffMinutesChange,
  agreement,
  onAgreementChange,
  acceptanceMode,
  onAcceptanceModeChange,
  actionLabelPreset,
  onActionLabelPresetChange,
  actionLabel,
  onActionLabelChange,
}: ApplicationPolicySettingsProps) {
  const agreementPreset =
    Object.entries(
      AGREEMENT_TEMPLATES,
    ).find(([, text]) => text === agreement)?.[0] ??
    (agreement ? "CUSTOM" : "NONE");

  return (
    <>
      <div className="mt-5 rounded-2xl border border-neutral-200 p-5">
        <div className="text-sm font-bold text-neutral-950">
          支払
        </div>

        <p className="mt-1 text-xs leading-5 text-neutral-500">
          無料、現地払い、またはPARARI決済（Square）を設定できます。
        </p>

        <div className="mt-4">
          <label className="block text-xs font-bold text-neutral-600">
            支払方法
          </label>

          <select
            value={paymentMethod}
            onChange={(event) => {
              onPaymentMethodChange(
                event.target.value as ApplicationPaymentMethod,
              );
            }}
            className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
          >
            <option value="none">
              無料
            </option>

            <option value="on_site">
              現地払い
            </option>

            <option value="parari">
              PARARI決済（Square）
            </option>

            {paymentMethod === "bank_transfer" ? (
              <option value="bank_transfer">
                銀行振込（旧設定）
              </option>
            ) : null}

            {paymentMethod === "payment_link" ? (
              <option value="payment_link">
                支払リンク（旧設定）
              </option>
            ) : null}

          </select>
        </div>

        {hasCalendarBlock && paymentMethod !== "none" ? (
          <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-3">
            <div className="text-sm font-bold text-neutral-900">
              料金は各開催回で設定します
            </div>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              CALENDARを使う募集では、APPLICATION側に参加費を重複して設定しません。
            </p>
          </div>
        ) : null}

        {paymentMethod !== "none" ? (
          <>
            {!hasCalendarBlock ? (
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
                      onPaymentAmountChange(
                        event.target.value,
                      )
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
                    onPaymentUrlChange(
                      event.target.value,
                    )
                  }
                  placeholder="https://..."
                  className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
                />
              </div>
            ) : null}

            <div className="mt-4">
              <label className="block text-xs font-bold text-neutral-600">
                {paymentMethod === "on_site"
                  ? "当日の支払案内"
                  : paymentMethod === "bank_transfer"
                    ? "振込案内"
                    : "支払についての案内"}
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
                    ? "例）当日受付で現金またはクレジットカードでお支払いください。"
                    : paymentMethod === "bank_transfer"
                      ? "例）振込先、振込期限などを入力してください。"
                      : "必要な案内があれば入力してください。"
                }
                className="mt-2 w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-7 outline-none focus:border-neutral-600"
              />
            </div>

            {paymentMethod === "bank_transfer" ||
            paymentMethod === "payment_link" ? (
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
                    主催者が着金を確認するまで、
                    参加は「確認中」となります。
                  </span>
                </span>
              </label>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="mt-5 rounded-2xl border border-neutral-200 p-5">
        <div className="text-sm font-bold text-neutral-950">
          キャンセル
        </div>

        <p className="mt-1 text-xs leading-5 text-neutral-500">
          参加者本人が申込後に取り下げ・キャンセルできる条件です。
          支払済みの場合も、返金の判断と処理は主催者が行います。
        </p>

        <select
          value={cancellationMode}
          onChange={(event) =>
            onCancellationModeChange(
              event.target.value as ApplicationCancellationMode,
            )
          }
          className="mt-3 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
        >
          <option value="not_allowed">参加者からのキャンセル不可</option>
          <option value="anytime">開催前ならいつでもキャンセル可</option>
          <option value="until_deadline">期限までキャンセル可</option>
        </select>

        {cancellationMode === "until_deadline" ? (
          hasCalendarBlock ? (
            <label className="mt-4 block">
              <span className="text-xs font-bold text-neutral-600">
                開催の何時間前まで
              </span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={
                  cancellationCutoffMinutes &&
                  Number.isFinite(Number(cancellationCutoffMinutes))
                    ? String(Number(cancellationCutoffMinutes) / 60)
                    : ""
                }
                onChange={(event) => {
                  const raw = event.target.value;
                  if (!raw) {
                    onCancellationCutoffMinutesChange("");
                    return;
                  }
                  const hours = Number(raw);
                  onCancellationCutoffMinutesChange(
                    Number.isFinite(hours) && hours >= 0
                      ? String(Math.round(hours * 60))
                      : "",
                  );
                }}
                placeholder="24"
                className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
              />
              <span className="mt-1 block text-xs leading-5 text-neutral-500">
                各開催回の開始時刻から逆算します。例：24 → 前日同時刻まで。
              </span>
            </label>
          ) : (
            <label className="mt-4 block">
              <span className="text-xs font-bold text-neutral-600">
                キャンセル期限
              </span>
              <input
                type="datetime-local"
                value={cancellationDeadlineAt}
                onChange={(event) =>
                  onCancellationDeadlineAtChange(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
              />
            </label>
          )
        ) : null}
      </div>

      <div className="mt-5 rounded-2xl border border-neutral-200 p-5">
        <div className="text-sm font-bold text-neutral-950">
          確認・同意事項
        </div>

        <p className="mt-1 text-xs leading-5 text-neutral-500">
          テンプレートを使ってすぐに作成できます。必要な部分だけ書き換えてください。
        </p>

        <select
          value={agreementPreset}
          onChange={(event) => {
            const value = event.target.value;

            if (value === "NONE") {
              onAgreementChange("");
              return;
            }

            if (value === "CUSTOM") {
              onAgreementChange("");
              return;
            }

            onAgreementChange(
              AGREEMENT_TEMPLATES[
                value as keyof typeof AGREEMENT_TEMPLATES
              ],
            );
          }}
          className="mt-3 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
        >
          <option value="NONE">
            設定しない
          </option>

          <optgroup label="テンプレートから選ぶ">
            <option value="EVENT">
              イベント・参加
            </option>
            <option value="APPLICATION">
              応募・選考
            </option>
            <option value="CONTACT">
              問い合わせ・相談
            </option>
            <option value="MEMBERSHIP">
              Membership・登録
            </option>
          </optgroup>

          <option value="CUSTOM">
            自分で作る
          </option>
        </select>

        {agreementPreset !== "NONE" ? (
          <textarea
            value={agreement}
            onChange={(event) =>
              onAgreementChange(
                event.target.value,
              )
            }
            rows={7}
            placeholder="確認・同意事項を入力してください。"
            className="mt-3 w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm leading-7 outline-none focus:border-neutral-600"
          />
        ) : null}
      </div>

      <div className="mt-5 rounded-2xl border border-neutral-200 p-5">
        <div className="text-sm font-bold text-neutral-950">
          資格・申込内容の確認
        </div>

        <label className="mt-4 flex items-start gap-3">
          <input
            type="radio"
            checked={acceptanceMode === "instant"}
            onChange={() =>
              onAcceptanceModeChange("instant")
            }
            className="mt-1"
          />

          <span>
            <span className="block text-sm font-bold text-neutral-900">
              資格確認は不要
            </span>

            <span className="mt-1 block text-xs leading-5 text-neutral-500">
              イベント参加など、その場で受付を確定します。
            </span>
          </span>
        </label>

        <label className="mt-4 flex items-start gap-3">
          <input
            type="radio"
            checked={acceptanceMode === "approval"}
            onChange={() =>
              onAcceptanceModeChange("approval")
            }
            className="mt-1"
          />

          <span>
            <span className="block text-sm font-bold text-neutral-900">
              資格・申込内容の確認が必要
            </span>

            <span className="mt-1 block text-xs leading-5 text-neutral-500">
              採用・審査・選考のある募集などに使用します。
            </span>
          </span>
        </label>
      </div>

      <div className="mt-5">
        <label className="block text-sm font-bold text-neutral-900">
          応募ボタン
        </label>

        <select
          value={actionLabelPreset}
          onChange={(event) => {
            const value = event.target.value;

            onActionLabelPresetChange(value);

            if (value === "OTHER") {
              onActionLabelChange("");
            } else {
              onActionLabelChange(value);
            }
          }}
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
        >
          {ACTION_LABEL_OPTIONS.map((label) => (
            <option
              key={label}
              value={label}
            >
              {label}
            </option>
          ))}

          <option value="OTHER">
            その他（自由入力）
          </option>
        </select>

        {actionLabelPreset === "OTHER" ? (
          <input
            type="text"
            value={actionLabel}
            onChange={(event) =>
              onActionLabelChange(
                event.target.value,
              )
            }
            placeholder="例）勇気を出して手を挙げる"
            className="mt-3 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
          />
        ) : null}
      </div>
    </>
  );
}
