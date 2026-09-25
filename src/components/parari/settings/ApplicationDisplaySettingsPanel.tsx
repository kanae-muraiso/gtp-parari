"use client";

import type {
  ApplicationDisplaySettings,
} from "@/components/parari/panels/application/applicationTypes";

type Props = {
  value: Required<ApplicationDisplaySettings>;
  onChange: (
    value: Required<ApplicationDisplaySettings>,
  ) => void;
};

const ITEMS: Array<{
  key: keyof Required<ApplicationDisplaySettings>;
  label: string;
  help: string;
}> = [
  {
    key: "applicationLabel",
    label: "APPLICATION",
    help: "パネル上部の「APPLICATION」表示",
  },
  {
    key: "typeLabel",
    label: "種類",
    help: "「募集」「イベント・参加募集」など",
  },
  {
    key: "title",
    label: "タイトル",
    help: "募集名・申込名",
  },
  {
    key: "status",
    label: "受付状態",
    help: "「受付中」「受付終了」など",
  },
  {
    key: "remainingSlots",
    label: "残り枠",
    help: "「残り10枠」など",
  },
];

export default function ApplicationDisplaySettingsPanel({
  value,
  onChange,
}: Props) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-sm font-bold text-neutral-950">
        表示設定
      </div>

      <p className="mt-1 text-xs leading-6 text-neutral-500">
        読者に必要な情報だけ表示します。すべてOFFでも、申込ボタンは表示されます。
      </p>

      <div className="mt-4 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
        {ITEMS.map((item) => (
          <label
            key={item.key}
            className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3"
          >
            <span>
              <span className="block text-sm font-bold text-neutral-800">
                {item.label}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
                {item.help}
              </span>
            </span>

            <input
              type="checkbox"
              checked={value[item.key]}
              onChange={(event) =>
                onChange({
                  ...value,
                  [item.key]:
                    event.target.checked,
                })
              }
              className="h-4 w-4 shrink-0"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
