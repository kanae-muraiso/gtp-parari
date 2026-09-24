"use client";

type FreeApplicationLiteSettingsProps = {
  actionLabel: string;
  onActionLabelChange: (value: string) => void;
};

export default function FreeApplicationLiteSettings({
  actionLabel,
  onActionLabelChange,
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

      <p className="mt-3 text-xs leading-6 text-neutral-500">
        FREEでは、ボタンを押した人のお名前と確認済みメールアドレスを受け取ります。
        PARARI未登録の方にはメール確認が自動で入ります。
      </p>
    </div>
  );
}
