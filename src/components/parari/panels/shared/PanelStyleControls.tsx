"use client";

import type { PanelVisualStyle } from "@/lib/parari/ssot-v2/panelStyle";

type Props = {
  value: PanelVisualStyle;
  onChange: (next: PanelVisualStyle) => void;
  allowWidth?: boolean;
};

const WIDTH_OPTIONS = [
  { value: "default", label: "標準" },
  { value: "100", label: "100%" },
  { value: "90", label: "90%" },
  { value: "75", label: "75%" },
  { value: "50", label: "50%" },
] as const;

const BORDER_COLOR_OPTIONS = [
  { value: "gray", label: "グレー" },
  { value: "black", label: "黒" },
  { value: "red", label: "赤" },
  { value: "orange", label: "オレンジ" },
  { value: "yellow", label: "黄" },
  { value: "green", label: "緑" },
  { value: "blue", label: "青" },
  { value: "purple", label: "紫" },
] as const;

export function PanelStyleControls({
  value,
  onChange,
  allowWidth = true,
}: Props) {
  const patch = <K extends keyof PanelVisualStyle>(
    key: K,
    nextValue: PanelVisualStyle[K],
  ) => {
    onChange({
      ...value,
      [key]: nextValue,
    });
  };

  return (
    <details className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
      <summary className="cursor-pointer select-none font-bold">
        スタイル
      </summary>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {allowWidth ? (
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold">幅</span>
            <select
              value={value.width}
              onChange={(event) =>
                patch("width", event.target.value as PanelVisualStyle["width"])
              }
              className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none"
            >
              {WIDTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold">境界線</span>
          <select
            value={value.border}
            onChange={(event) =>
              patch("border", event.target.value as PanelVisualStyle["border"])
            }
            className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none"
          >
            <option value="none">なし</option>
            <option value="thin">細線</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold">境界線の色</span>
          <select
            value={value.borderColor}
            disabled={value.border === "none"}
            onChange={(event) =>
              patch(
                "borderColor",
                event.target.value as PanelVisualStyle["borderColor"],
              )
            }
            className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none disabled:opacity-40"
          >
            {BORDER_COLOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold">角の丸み</span>
          <select
            value={value.radius}
            onChange={(event) =>
              patch("radius", event.target.value as PanelVisualStyle["radius"])
            }
            className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none"
          >
            <option value="none">なし</option>
            <option value="s">小</option>
            <option value="m">中</option>
            <option value="l">大</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold">内側余白</span>
          <select
            value={value.padding}
            onChange={(event) =>
              patch(
                "padding",
                event.target.value as PanelVisualStyle["padding"],
              )
            }
            className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none"
          >
            <option value="none">なし</option>
            <option value="s">小</option>
            <option value="m">中</option>
            <option value="l">大</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-bold">下余白</span>
          <select
            value={value.gap}
            onChange={(event) =>
              patch("gap", event.target.value as PanelVisualStyle["gap"])
            }
            className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none"
          >
            <option value="default">標準</option>
            <option value="zero">なし</option>
            <option value="s">小</option>
            <option value="m">中</option>
            <option value="l">大</option>
          </select>
        </label>
      </div>
    </details>
  );
}
