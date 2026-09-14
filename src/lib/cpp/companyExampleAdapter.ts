import type { CompanyExample, CompanyExampleSection } from "@/lib/cpp/companyExamples";
import {
  getCppCompanyTemplate,
  layoutFromCppCompanyTemplate,
  templateTypeFromExampleSlug,
} from "@/lib/cpp/companyPageTemplates";
import type { CppCompanyPublicModel } from "@/lib/cpp/companyPublicTypes";

export function companyExampleToPublicModel(example: CompanyExample): CppCompanyPublicModel {
  const presentationType = templateTypeFromExampleSlug(example.slug);
  const template = getCppCompanyTemplate(presentationType);

  const mappedBlocks = example.sections.map((section, index) => ({
    id: `sample-block-${index + 1}`,
    kind: inferKind(section, presentationType),
    title: section.title,
    body: sectionToSsot(section),
    sortOrder: index,
  }));

  const hasCompanyBlock = mappedBlocks.some((row) => row.kind !== "research");
  const hasResearchBlock = mappedBlocks.some((row) => row.kind === "research");
  const blocks = [...mappedBlocks];

  if (!hasCompanyBlock) {
    blocks.unshift({
      id: "sample-company-intro",
      kind: "company",
      title: "私たちについて",
      body: `[T]\n${example.heroLead}`,
      sortOrder: -1,
    });
  }
  if (!hasResearchBlock) {
    blocks.push({
      id: "sample-research-intro",
      kind: "research",
      title: "研究・技術への考え方",
      body: `[T]\n${example.typeDescription}`,
      sortOrder: blocks.length,
    });
  }

  const positions = example.recruitments.map((row, index) => ({
    id: `sample-position-${index + 1}`,
    title: row.title,
    summary: row.summary,
    roleBody: null,
    researchBody: row.tags.length > 0 ? `[T]\n${row.tags.join(" / ")}` : null,
    idealCandidateBody: `[T]\n${example.closingMessage}`,
    degreeRequirement: detailValue(row.details, "対象"),
    employmentType: detailValue(row.details, "雇用"),
    defaultLocation: detailValue(row.details, "勤務地"),
    researchKeywords: row.tags,
    isActive: true,
    sortOrder: index,
  }));

  const recruitments = example.recruitments.map((row, index) => ({
    id: `sample-recruitment-${index + 1}`,
    positionId: positions[index]?.id ?? null,
    title: row.title,
    cycleLabel: "2026 SAMPLE",
    opensOn: null,
    deadline: null,
    employmentType: detailValue(row.details, "雇用"),
    location: detailValue(row.details, "勤務地"),
    degreeRequirement: detailValue(row.details, "対象"),
    salaryText: detailValue(row.details, "給与"),
    positionsCount: parsePositions(detailValue(row.details, "募集")),
    summary: row.summary,
    jobBody: row.subtitle ? `[T]\n${row.subtitle}` : null,
    qualificationsBody: row.tags.length > 0 ? `[T]\n${row.tags.join(" / ")}` : null,
    conditionsBody: null,
    applicationUrl: null,
    status: "published" as const,
    sortOrder: index,
  }));

  const materials = template.sections.some((section) => section.key === "materials" && section.visible)
    ? [{
      id: "sample-material-1",
      title: "研究開発・会社紹介資料",
      materialType: "pdf" as const,
      filePath: null,
      fileName: "company-research-guide.pdf",
      externalUrl: null,
      description: "実際の企業ページでは、PDF・YouTube・外部資料をここに掲載できます。",
      sortOrder: 0,
    }]
    : [];

  return {
    company: {
      name: example.companyName,
      tagline: example.heroTitle,
      industry: example.industry,
      headquarters: example.location,
      websiteUrl: null,
      shortDescription: example.heroLead,
      logoUrl: null,
      recruitmentDisplayMode: template.recruitmentDisplayMode,
    },
    blocks,
    positions,
    recruitments,
    materials,
    layout: layoutFromCppCompanyTemplate(presentationType),
  };
}

function sectionToSsot(section: CompanyExampleSection) {
  const parts: string[] = [];
  if (section.lead) parts.push(section.lead);
  if (section.paragraphs) parts.push(...section.paragraphs);
  if (section.bullets?.length) parts.push(section.bullets.map((item) => `・${item}`).join("\n"));
  if (section.stats?.length) parts.push(section.stats.map((item) => `${item.label}: ${item.value}`).join("\n"));
  return `[T]\n${parts.join("\n\n")}`;
}

function inferKind(section: CompanyExampleSection, type: ReturnType<typeof templateTypeFromExampleSlug>) {
  const title = section.title.toLowerCase();
  if (type === "research_first" || type === "researcher_first") return "research";
  if (/(研究|技術|science|technology|r&d|創薬|材料|ユニット|課題)/i.test(title)) return "research";
  if (type === "challenge_first") return "challenge";
  if (type === "culture_first") return "culture";
  return "company";
}

function detailValue(details: Array<{ label: string; value: string }>, label: string) {
  return details.find((row) => row.label.includes(label))?.value ?? null;
}

function parsePositions(value: string | null) {
  if (!value) return null;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}
