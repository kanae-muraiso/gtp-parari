"use client";

export default function CppLiveRoleColors() {
  return (
    <style jsx global>{`
      /*
       * CPP LIVE person colors
       * Self       = blue
       * Researcher = violet
       * Company    = orange
       *
       * Keep the selectors tied only to the marker's semantic visual state.
       * Layout utility classes may change without silently losing role colors.
       */
      main button.absolute.z-30 > span.h-9.w-9.rounded-full {
        border: 3px solid var(--cpp-person-color) !important;
        background: var(--cpp-person-fill) !important;
        box-sizing: border-box;
      }

      /* Researcher */
      main button.absolute.z-30 > span.h-9.w-9.bg-neutral-950:not(.ring-4) {
        --cpp-person-color: #7c3aed;
        --cpp-person-fill: #7c3aed;
      }

      /* Company */
      main button.absolute.z-30 > span.h-9.w-9.bg-white:not(.ring-4) {
        --cpp-person-color: #f97316;
        --cpp-person-fill: #fff7ed;
      }

      main button.absolute.z-30 > span.h-9.w-9.bg-white:not(.ring-4) > span {
        background: #f97316 !important;
      }

      /* Self always wins over organization role. */
      main button.absolute.z-30 > span.h-9.w-9.ring-4 {
        --cpp-person-color: #2563eb;
        --cpp-person-fill: #2563eb;
        --tw-ring-color: rgba(37, 99, 235, 0.22) !important;
      }

      main button.absolute.z-30 > span.h-9.w-9.ring-4 > span {
        background: #ffffff !important;
      }
    `}</style>
  );
}
