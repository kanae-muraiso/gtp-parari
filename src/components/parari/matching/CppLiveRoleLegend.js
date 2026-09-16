"use client";

const ITEMS = [
  { label: "自分", color: "#2563eb" },
  { label: "研究者", color: "#7c3aed" },
  { label: "企業", color: "#f97316" },
];

export default function CppLiveRoleLegend() {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] hidden items-center gap-3 rounded-full border border-neutral-200 bg-white/90 px-3 py-2 text-[10px] font-bold text-neutral-600 shadow-sm backdrop-blur sm:flex">
      {ITEMS.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
