type EntryStatus =
  | "submitted"
  | "confirmed"
  | "rejected"
  | "withdrawn"
  | "cancelled";

type EntryPaymentStatus =
  | "not_required"
  | "unpaid"
  | "reported"
  | "paid";

type EntryPayment = {
  method:
    | "none"
    | "on_site"
    | "bank_transfer"
    | "payment_link";
  amount: number | null;
  instructions: string | null;
  url: string | null;
};

type Props = {
  entry: {
    status: EntryStatus;
    payment_status: EntryPaymentStatus;
  };
  payment: EntryPayment | null;
  qualificationReady: boolean;
  isReportingPayment: boolean;
  paymentMessage: string;
  onReportPayment: () => void;
  canCancel: boolean;
  isCancelling: boolean;
  cancellationMessage: string;
  onCancel: () => void;
};

export default function ApplicationEntryStatusPanel({
  entry,
  payment,
  qualificationReady,
  isReportingPayment,
  paymentMessage,
  onReportPayment,
  canCancel,
  isCancelling,
  cancellationMessage,
  onCancel,
}: Props) {
  const active =
    entry.status === "submitted" ||
    entry.status === "confirmed";

  const title =
    entry.status === "confirmed"
      ? "お申し込みは確定しています"
      : entry.status === "rejected"
        ? "今回は受付されませんでした"
        : entry.status === "withdrawn"
          ? "申込を取り下げました"
          : entry.status === "cancelled"
            ? "参加をキャンセルしました"
            : "お申し込みを受け付けました";

  const description =
    entry.status === "confirmed"
      ? "参加・申込が確定しています。"
      : entry.status === "rejected"
        ? "このAPPLICATIONへの再申込はできません。"
        : entry.status === "withdrawn"
          ? "この申込は取り下げ済みです。必要であれば、受付中の間は改めて申し込めます。"
          : entry.status === "cancelled"
            ? "この参加予約はキャンセル済みです。必要であれば、受付中の間は改めて申し込めます。"
            : "現在、主催者の確認待ちです。";

  return (
    <>
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
        <div className="text-lg font-bold text-neutral-950">
          {title}
        </div>

        <p className="mt-2 text-sm leading-7 text-neutral-600">
          {description}
        </p>
      </div>

      {payment &&
      payment.method !== "none" &&
      active ? (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="text-sm font-bold text-neutral-950">
            お支払い
          </div>

          {payment.amount !== null ? (
            <div className="mt-2 text-lg font-bold text-neutral-950">
              {payment.amount.toLocaleString("ja-JP")}円
            </div>
          ) : null}

          {entry.payment_status === "paid" ? (
            <div className="mt-3 rounded-xl bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-700">
              ✓ 支払確認済み
            </div>
          ) : payment.method === "on_site" ? (
            <>
              <div className="mt-3 text-sm font-bold text-neutral-700">
                当日払い
              </div>

              {payment.instructions ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-neutral-600">
                  {payment.instructions}
                </p>
              ) : null}
            </>
          ) : entry.payment_status === "reported" ? (
            <div className="mt-3 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              支払の連絡を受け付けました。
              現在、主催者の着金確認待ちです。
            </div>
          ) : !qualificationReady ? (
            <div className="mt-3 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              主催者の確認が終わると、
              支払手続きができるようになります。
            </div>
          ) : (
            <>
              {payment.instructions ? (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-neutral-600">
                  {payment.instructions}
                </p>
              ) : null}

              {payment.method === "payment_link" && payment.url ? (
                <a
                  href={payment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block w-full rounded-full bg-neutral-950 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-neutral-700"
                >
                  支払う
                </a>
              ) : null}

              <button
                type="button"
                disabled={isReportingPayment}
                onClick={onReportPayment}
                className="mt-3 w-full rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40"
              >
                {isReportingPayment
                  ? "送信中..."
                  : "支払いました"}
              </button>

              <p className="mt-2 text-center text-xs leading-5 text-neutral-400">
                支払後にこのボタンを押してください。
                主催者が着金を確認すると「支払確認済み」になります。
              </p>
            </>
          )}

          {paymentMessage ? (
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              {paymentMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {active && canCancel ? (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="text-sm font-bold text-neutral-950">
            申込の変更
          </div>
          <p className="mt-2 text-xs leading-6 text-neutral-500">
            支払済みの場合も返金は自動では行われません。返金の可否と手続きは主催者が判断します。
          </p>
          <button
            type="button"
            disabled={isCancelling}
            onClick={onCancel}
            className="mt-4 w-full rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40"
          >
            {isCancelling
              ? "処理しています..."
              : entry.status === "submitted"
                ? "申込を取り下げる"
                : "参加をキャンセルする"}
          </button>
        </div>
      ) : null}

      {cancellationMessage ? (
        <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-700">
          {cancellationMessage}
        </p>
      ) : null}
    </>
  );
}
