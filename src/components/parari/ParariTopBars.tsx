import type { ReactNode } from "react";

type OwnerBarProps = {
  title?: string;
  leftHref?: string;
  leftLabel?: string;
  hideLeftButton?: boolean;
  actions?: ReactNode;
};

export function ParariOwnerTopBar({
  title = "管理モード",
  leftHref = "/my/works",
  leftLabel = "作品リストへ",
  hideLeftButton = false,
  actions,
}: OwnerBarProps) {
  const shouldShowLeftButton =
    !hideLeftButton && Boolean(leftHref) && Boolean(leftLabel);

  return (
    <div className="sticky top-0 z-[9999] border-b border-black bg-black px-4 py-2 text-white shadow-sm">
      <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3">
        {shouldShowLeftButton ? (
          <a
            href={leftHref}
            className="rounded-lg border border-white/25 px-3 py-1 text-sm font-semibold hover:bg-white/10"
          >
            {leftLabel}
          </a>
        ) : (
          <div />
        )}

        <div className="min-w-0 flex-1 text-center text-sm font-semibold text-white/80">
          {title}
        </div>

        <div className="flex items-center gap-2">
          {actions}
        </div>
      </div>
    </div>
  );
}

type TopBarButtonProps = {
  href?: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

export function ParariTopBarButton({
  href,
  children,
  onClick,
  disabled = false,
}: TopBarButtonProps) {
  const className = [
    "rounded-lg border border-white/25 px-3 py-1 text-sm font-semibold text-white transition hover:bg-white/10",
    disabled ? "cursor-not-allowed opacity-50" : "",
  ].join(" ");

  if (href) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  );
}

type BrandTopBarProps = {
  title?: string;
  href?: string;
  actions?: ReactNode;
};

export function ParariBrandTopBar({
  title = "PARARI",
  href,
  actions,
}: BrandTopBarProps) {
  return (
    <div className="sticky top-0 z-[9999] border-b border-black bg-black px-4 py-2 text-white shadow-sm">
      <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3">
        {href ? (
          <a
            href={href}
            className="text-sm font-bold tracking-[0.18em] text-white transition hover:text-white/80"
          >
            {title}
          </a>
        ) : (
          <div className="text-sm font-bold tracking-[0.18em] text-white">
            {title}
          </div>
        )}

        <div className="flex items-center gap-2">
          {actions}
        </div>
      </div>
    </div>
  );
}
