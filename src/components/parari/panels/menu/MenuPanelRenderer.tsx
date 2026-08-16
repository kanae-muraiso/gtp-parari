import type { PanelRendererProps } from "../panelDefinitionTypes";
import type {
  MenuPanelData,
  MenuPanelVariant,
  MenuPanelWidth,
} from "./parseMenuPanel";

const MENU_VARIANT_CLASSES: Record<MenuPanelVariant, string> = {
  black: "bg-neutral-950 text-white shadow-sm",
  white: "bg-white text-neutral-900 ring-1 ring-neutral-200 shadow-sm",
  gray: "bg-neutral-100 text-neutral-900 ring-1 ring-neutral-200",
  primary: "bg-blue-700 text-white shadow-sm",
};

const MENU_LINK_CLASSES: Record<MenuPanelVariant, string> = {
  black: "text-white hover:bg-white/10",
  white: "text-neutral-800 hover:bg-neutral-100",
  gray: "text-neutral-800 hover:bg-white/70",
  primary: "text-white hover:bg-white/10",
};

const MENU_WIDTH_CLASSES: Record<MenuPanelWidth, string> = {
  normal: "w-full",
  full: "relative left-1/2 w-[calc(100vw-16px)] max-w-[720px] -translate-x-1/2 sm:w-[calc(100vw-32px)]",
};

const MENU_SHAPE_CLASSES: Record<MenuPanelWidth, string> = {
  normal: "rounded-2xl",
  full: "rounded-none",
};

export function MenuPanelRenderer({
  data,
}: PanelRendererProps<MenuPanelData>) {
  const items = data.items.filter(
    (item) => item.label.trim().length > 0 && item.url.trim().length > 0,
  );

  if (items.length === 0) {
    return null;
  }

  const variant = data.variant || "black";
  const width = data.width || "normal";

  return (
    <nav
      className={[
        "my-5 px-3 py-3",
        MENU_VARIANT_CLASSES[variant] ?? MENU_VARIANT_CLASSES.black,
        MENU_WIDTH_CLASSES[width] ?? MENU_WIDTH_CLASSES.normal,
        MENU_SHAPE_CLASSES[width] ?? MENU_SHAPE_CLASSES.normal,
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {items.map((item, index) => (
          <a
            key={`${item.label}-${item.url}-${index}`}
            href={item.url}
            className={[
              "rounded-full px-3 py-1.5 text-xs font-bold transition",
              MENU_LINK_CLASSES[variant] ?? MENU_LINK_CLASSES.black,
            ].join(" ")}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
