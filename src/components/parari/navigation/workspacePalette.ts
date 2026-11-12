// A single source for environment identity. Action/status colors are intentionally separate.
// LIBRARY: reading and collecting / STUDIO: creating and managing.
export const WORKSPACE_PALETTE = {
  library: {
    logo: "bg-emerald-300 text-emerald-950 shadow-sm hover:bg-emerald-400",
    header: "border-emerald-200 bg-emerald-50/40",
    tabActive: "border-emerald-300 bg-emerald-300 text-emerald-950",
    button: "bg-emerald-300 text-emerald-950 hover:bg-emerald-400",
    quietButton: "border-emerald-200 bg-emerald-100 text-emerald-950 hover:bg-emerald-200",
  },
  studio: {
    logo: "bg-[#2467A4] text-white shadow-sm hover:bg-[#1D5588]",
    header: "border-blue-200 bg-blue-50/40",
    tabActive: "border-[#2467A4] bg-[#2467A4] text-white",
    button: "bg-[#2467A4] text-white hover:bg-[#1D5588]",
    quietButton: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
  },
} as const;
