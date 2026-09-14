export type CppCompanySectionKey = "company" | "research" | "positions" | "recruitments" | "materials";
export type CppCompanyDisplayStyle = "standard" | "cards" | "featured" | "compact";
export type CppRecruitmentDisplayMode = "integrated" | "separate" | "hybrid";

export type CppCompanyPublicCompany = {
  id?: string;
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
  tagline?: string | null;
  industry?: string | null;
  headquarters?: string | null;
  websiteUrl?: string | null;
  shortDescription?: string | null;
  recruitmentDisplayMode: CppRecruitmentDisplayMode;
};

export type CppCompanyPublicBlock = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  sortOrder: number;
};

export type CppCompanyPublicPosition = {
  id: string;
  title: string;
  summary: string | null;
  roleBody: string | null;
  researchBody: string | null;
  idealCandidateBody: string | null;
  degreeRequirement: string | null;
  employmentType: string | null;
  defaultLocation: string | null;
  researchKeywords: string[];
  isActive: boolean;
  sortOrder: number;
};

export type CppCompanyPublicRecruitment = {
  id: string;
  positionId: string | null;
  title: string;
  cycleLabel: string | null;
  opensOn: string | null;
  deadline: string | null;
  employmentType: string | null;
  location: string | null;
  degreeRequirement: string | null;
  salaryText: string | null;
  positionsCount: number | null;
  summary: string | null;
  jobBody: string | null;
  qualificationsBody: string | null;
  conditionsBody: string | null;
  applicationUrl: string | null;
  status: "draft" | "published" | "closed";
  sortOrder: number;
};

export type CppCompanyPublicMaterial = {
  id: string;
  title: string;
  materialType: "pdf" | "link" | "youtube";
  filePath: string | null;
  fileName: string | null;
  externalUrl: string | null;
  description: string | null;
  sortOrder: number;
};

export type CppCompanyPublicLayoutRow = {
  sectionKey: CppCompanySectionKey;
  isVisible: boolean;
  displayStyle: CppCompanyDisplayStyle;
  sortOrder: number;
};

export type CppCompanyPublicModel = {
  company: CppCompanyPublicCompany;
  blocks: CppCompanyPublicBlock[];
  positions: CppCompanyPublicPosition[];
  recruitments: CppCompanyPublicRecruitment[];
  materials: CppCompanyPublicMaterial[];
  layout: CppCompanyPublicLayoutRow[];
};
