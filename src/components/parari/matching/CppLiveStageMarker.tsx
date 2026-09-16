"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function CppLiveStageMarker() {
  const [floor, setFloor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute left-0 top-12 z-20 h-44 w-44 overflow-hidden text-left sm:h-64 sm:w-64"
        aria-label="STAGEを開く"
      >
        <span
          className="absolute inset-0 bg-neutral-700 transition hover:bg-neutral-800"
          style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
        />
        <span className="absolute left-5 top-14 -rotate-45 text-3xl font-light tracking-[0.08em] text-white sm:left-10 sm:top-24 sm:text-5xl">
          STAGE
        </span>
      </button>

      {open ? (
        <div className="absolute inset-0 z-[80] flex items-center justify-center bg-white/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-neutral-200 bg-white p-7 text-center shadow-xl">
            <div className="text-[10px] font-black tracking-[0.18em] text-neutral-400">CPP LIVE · STAGE</div>
            <h2 className="mt-3 text-2xl font-black text-neutral-950">STAGE</h2>
            <p className="mt-4 text-sm leading-7 text-neutral-600">
              ここからライブ配信を視聴できます。企業説明やミニトーク、イベントなど、配信中のプログラムがあるときにSTAGEから参加できます。
            </p>
            <div className="mt-5 rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-bold text-neutral-500">
              現在、配信中のプログラムはありません
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 rounded-full bg-neutral-950 px-6 py-2.5 text-xs font-black text-white"
            >
              LIVE空間に戻る
            </button>
          </div>
        </div>
      ) : null}
    </>,
    floor,
  );
}
