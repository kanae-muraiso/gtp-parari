"use client";

type Props = {
  enabled: boolean;
  onChange: (value: boolean) => void;
};

export default function ApplicationPassSettings({
  enabled,
  onChange,
}: Props) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-sm font-bold text-neutral-950">
        参加証（QRコード）
      </div>

      <p className="mt-1 text-xs leading-6 text-neutral-500">
        当日の受付でQR参加証が必要な場合だけ発行します。資料請求やダウンロードだけのAPPLICATIONでは不要です。
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() =>
            onChange(false)
          }
          className={[
            "rounded-xl border px-4 py-3 text-left text-sm font-bold transition",
            !enabled
              ? "border-neutral-950 bg-neutral-950 text-white"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100",
          ].join(" ")}
        >
          発行しない
        </button>

        <button
          type="button"
          onClick={() =>
            onChange(true)
          }
          className={[
            "rounded-xl border px-4 py-3 text-left text-sm font-bold transition",
            enabled
              ? "border-neutral-950 bg-neutral-950 text-white"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100",
          ].join(" ")}
        >
          発行する
        </button>
      </div>
    </div>
  );
}
