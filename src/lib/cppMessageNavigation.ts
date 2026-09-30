export type CppMessageScope = "cpp" | "alumni";

// Keep the entry context in the URL so separate CPP/alumni tabs do not interfere.
export function cppMessageHref(
  scope: CppMessageScope = "cpp",
  { to, settings = false }: { to?: string; settings?: boolean } = {},
) {
  const params = new URLSearchParams();
  if (to) params.set("to", to);
  if (scope === "alumni") params.set("from", "alumni");
  const query = params.toString();
  return `/my/cpp/messages${settings ? "/settings" : ""}${query ? `?${query}` : ""}`;
}
