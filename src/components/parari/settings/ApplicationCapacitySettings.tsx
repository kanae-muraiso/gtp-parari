"use client";

type Props = {
  enabled: boolean;
  value: string;
  participantLimit: number | null;
  onEnabledChange: (enabled: boolean) => void;
  onValueChange: (value: string) => void;
};

export default function ApplicationCapacitySettings({
  enabled,
  value,
  participantLimit,
  onEnabledChange,
  onValueChange,
}: Props) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-sm font-bold text-neutral-950">
        定員
      </div>

      <p className="mt-1 text-xs leading-6 text-neutral-500">
        このAPPLICATIONで受け付ける人数を設定します。プランに人数上限がある場合は、より小さい方が実際の受付上限になります。
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() =>
            onEnabledChange(false)
          }
          className={[
            "rounded-xl border px-4 py-3 text-left text-sm font-bold transition",
            !enabled
              ? "border-neutral-950 bg-neutral-950 text-white"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100",
          ].join(" ")}
        >
          人数を指定しない
        </button>

        <button
          type="button"
          onClick={() =>
            onEnabledChange(true)
          }
          className={[
            "rounded-xl border px-4 py-3 text-left text-sm font-bold transition",
            enabled
              ? "border-neutral-950 bg-neutral-950 text-white"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100",
          ].join(" ")}
        >
          人数を指定する
        </button>
      </div>

      {enabled ? (
        <label className="mt-4 block">
          <span className="text-xs font-bold text-neutral-600">
            定員
          </span>

          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={1}
              step={1}
              value={value}
              onChange={(event) =>
                onValueChange(
                  event.target.value,
                )
              }
              placeholder="例）5"
              className="w-32 rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-600"
            />
            <span className="text-sm text-neutral-600">
              人
            </span>
          </div>
        </label>
      ) : null}

      {participantLimit !== null ? (
        <p className="mt-3 text-xs leading-6 text-neutral-500">
          現在のプラン上限は1 APPLICATIONあたり
          <strong className="mx-1 text-neutral-700">
            {participantLimit}人
          </strong>
          です。
        </p>
      ) : (
        <p className="mt-3 text-xs leading-6 text-neutral-500">
          現在のプランにはAPPLICATION参加人数の上限はありません。
        </p>
      )}
    </div>
  );
}
