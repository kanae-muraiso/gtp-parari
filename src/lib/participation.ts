// 2026-10-04 JST
// PART: Participation destinations (navigation only; never a content entitlement).
export type Participation = {
  key: string;
  name: string;
  href: string;
  action: string;
  state: "active" | "incomplete" | "restricted";
};

export type ParticipationFacts = {
  alumni: { is_alumni: boolean; choice: string; is_operator: boolean } | null;
  researcher: { profile_exists: boolean; required_complete: boolean; participating: boolean; admitted: boolean } | null;
  mode: string | null;
  hasCompany: boolean;
  cppMembershipIds: string[];
  memberships: { id: string; name: string }[];
};

export function membershipShelfHref(id: string) {
  return `/my/bookshelf?tab=membership&membership=${encodeURIComponent(id)}`;
}

export function buildParticipations(facts: ParticipationFacts): Participation[] {
  const result: Participation[] = [];
  const researcher = facts.researcher;
  const operator = facts.alumni?.is_operator === true;
  const hasResearcher = researcher?.participating && (researcher.profile_exists || (facts.alumni?.is_alumni && facts.alumni.choice === "researcher"));
  const alumniOnly = facts.alumni?.is_alumni && facts.alumni.choice === "alumni";
  const hasCppMembership = !alumniOnly && facts.memberships.some(item => facts.cppMembershipIds.includes(item.id));
  if (operator || facts.hasCompany || hasResearcher || hasCppMembership) {
    const incomplete = !operator && !facts.hasCompany && !!hasResearcher && !researcher?.required_complete;
    const restricted = !operator && !facts.hasCompany && !!hasResearcher && !!researcher?.required_complete && !researcher.admitted;
    result.push({
      key: "cpp", name: "CPP", href: incomplete ? (researcher?.profile_exists ? "/my/cpp" : "/cpp/try") : "/my/cpp/home",
      action: incomplete ? "登録を続ける" : restricted ? "利用状況を確認" : "開く",
      state: incomplete ? "incomplete" : restricted ? "restricted" : "active",
    });
  }
  if (facts.alumni?.is_alumni || (operator && facts.mode === "admin")) {
    result.push({ key: "cpp-alumni", name: "CPP同窓会", href: "/cpp/alumni", action: "開く", state: "active" });
  }
  for (const membership of facts.memberships) {
    if (facts.cppMembershipIds.includes(membership.id) || result.some(item => item.key === `membership:${membership.id}`)) continue;
    result.push({ key: `membership:${membership.id}`, name: membership.name, href: membershipShelfHref(membership.id), action: "開く", state: "active" });
  }
  return result;
}

export function parseParticipationKey(value: string | null): string | null {
  return value && /^(cpp|cpp-alumni|membership:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(value) ? value : null;
}

// Only a known PARARI URL receives context; a return hint never supplies a destination URL.
export function withParticipation(href: string, key: string): string {
  if (!parseParticipationKey(key)) return href;
  try {
    const url = new URL(href, "https://www.parari.app");
    if (url.protocol !== "https:" || !["parari.app", "www.parari.app"].includes(url.hostname)) return href;
    url.searchParams.set("participation", key);
    return href.startsWith("/") && !href.startsWith("//") ? `${url.pathname}${url.search}${url.hash}` : url.href;
  } catch { return href; }
}

export function participationAtLocation(pathname: string, search: URLSearchParams): string | null {
  if (pathname === "/cpp/alumni" || pathname.startsWith("/cpp/alumni/")) return "cpp-alumni";
  if (pathname.startsWith("/my/cpp/messages") && search.get("from") === "alumni") return "cpp-alumni";
  if (pathname === "/my/cpp/social-profile" && search.get("returnTo") === "/cpp/alumni") return "cpp-alumni";
  if (pathname === "/my/cpp" || pathname.startsWith("/my/cpp/")) return "cpp";
  if (pathname === "/my/bookshelf" && search.get("tab") === "membership") return parseParticipationKey(`membership:${search.get("membership")}`);
  return parseParticipationKey(search.get("participation"));
}
