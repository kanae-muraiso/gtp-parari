"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function CppLiveStageMarker() {
  const [floor, setFloor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const findFloor = () => {
      const next = document.querySelector<HTMLElement>('section[class*="min-h-[650px]"]');
      setFloor(next);
    };

    findFloor();
    const observer = new MutationObserver(findFloor);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!floor) return null;

  return createPortal(
    <div
      className="pointer-events-none absolute left-5 top-16 z-20 h-24 w-36 drop-shadow-sm"
      aria-label="CPP LIVE STAGE"
    >
      <div
        className="absolute inset-0 bg-neutral-900"
        style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
      />
      <div className="absolute inset-x-0 top-4 text-center text-[11px] font-black tracking-[0.18em] text-white">
        STAGE
      </div>
    </div>,
    floor,
  );
}
