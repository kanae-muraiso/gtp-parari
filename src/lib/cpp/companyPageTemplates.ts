import type {
  CppCompanyDisplayStyle,
  CppCompanyPublicLayoutRow,
  CppCompanySectionKey,
  CppRecruitmentDisplayMode,
} from "@/lib/cpp/companyPublicTypes";

export type CppCompanyPresentationType =
  | "position_first"
  | "researcher_first"
  | "research_first"
  | "culture_first"
  | "challenge_first";

export type CppCompanyPageTemplate = {
  id: CppCompanyPresentationType;
  label: string;
  shortLabel: string;
  description: string;
  recommendedFor: string;
  recruitmentDisplayMode: CppRecruitmentDisplayMode;
  sections: Array<{
    key: CppCompanySectionKey;
    style: CppCompanyDisplayStyle;
    visible: boolean;
  }>;
};

export const CPP_COMPANY_PAGE_TEMPLATES: Record<CppCompanyPresentationType, CppCompanyPageTemplate> = {
  position_first: {
    id: "position_first",
    label: "募集ポジション型",
    shortLabel: "いま募集している仕事から見せる",
    description: "現在の募集を入口にして、求める研究者像、会社、研究・技術へと理解を広げる構成です。",
    recommendedFor: "募集職種が明確で、研究者に『今どんな仕事があるか』を最初に伝えたい会社",
    recruitmentDisplayMode: "integrated",
    sections: [
      { key: "recruitments", style: "featured", visible: true },
      { key: "positions", style: "cards", visible: true },
      { key: "company", style: "standard", visible: true },
      { key: "research", style: "standard", visible: true },
      { key: "materials", style: "compact", visible: false },
    ],
  },
  researcher_first: {
    id: "researcher_first",
    label: "求める研究者型",
    shortLabel: "どんな博士と会いたいかから見せる",
    description: "職種名より先に、継続して求めている専門性や研究者像を示す構成です。",
    recommendedFor: "複数の研究部門があり、職種名だけでは必要な専門性を表しにくい会社",
    recruitmentDisplayMode: "hybrid",
    sections: [
      { key: "positions", style: "featured", visible: true },
      { key: "research", style: "cards", visible: true },
      { key: "company", style: "standard", visible: true },
      { key: "recruitments", style: "compact", visible: true },
      { key: "materials", style: "compact", visible: false },
    ],
  },
  research_first: {
    id: "research_first",
    label: "研究・技術型",
    shortLabel: "科学と技術から会社を理解してもらう",
    description: "研究テーマやコア技術を主役にし、その科学を次へ進める研究者・募集へつなげる構成です。",
    recommendedFor: "研究開発の厚みやコア技術そのものが博士採用上の魅力になる会社",
    recruitmentDisplayMode: "hybrid",
    sections: [
      { key: "research", style: "featured", visible: true },
      { key: "company", style: "standard", visible: true },
      { key: "positions", style: "cards", visible: true },
      { key: "recruitments", style: "standard", visible: true },
      { key: "materials", style: "cards", visible: true },
    ],
  },
  culture_first: {
    id: "culture_first",
    label: "会社・文化型",
    shortLabel: "会社の考え方と研究文化から見せる",
    description: "会社のミッション、研究文化、働き方を先に伝え、研究・技術と募集へつなげる構成です。",
    recommendedFor: "研究者が働く環境、価値観、組織文化そのものを採用上の強みにしたい会社",
    recruitmentDisplayMode: "hybrid",
    sections: [
      { key: "company", style: "featured", visible: true },
      { key: "research", style: "standard", visible: true },
      { key: "positions", style: "standard", visible: true },
      { key: "materials", style: "cards", visible: true },
      { key: "recruitments", style: "compact", visible: true },
    ],
  },
  challenge_first: {
    id: "challenge_first",
    label: "ベンチャー・挑戦型",
    shortLabel: "なぜこの会社が存在するのかから見せる",
    description: "会社が挑戦している課題やストーリーを入口に、技術、仲間、現在の募集へつなげる構成です。",
    recommendedFor: "会社の存在理由や未解決の課題そのものに研究者を惹きつけたいスタートアップ・新規事業",
    recruitmentDisplayMode: "separate",
    sections: [
      { key: "company", style: "featured", visible: true },
      { key: "research", style: "cards", visible: true },
      { key: "positions", style: "standard", visible: true },
      { key: "materials", style: "cards", visible: true },
      { key: "recruitments", style: "compact", visible: true },
    ],
  },
};

export const CPP_COMPANY_PRESENTATION_TYPES = Object.keys(
  CPP_COMPANY_PAGE_TEMPLATES,
) as CppCompanyPresentationType[];

export function getCppCompanyTemplate(type: string | null | undefined): CppCompanyPageTemplate {
  if (type && type in CPP_COMPANY_PAGE_TEMPLATES) {
    return CPP_COMPANY_PAGE_TEMPLATES[type as CppCompanyPresentationType];
  }
  return CPP_COMPANY_PAGE_TEMPLATES.culture_first;
}

export function layoutFromCppCompanyTemplate(type: string | null | undefined): CppCompanyPublicLayoutRow[] {
  return getCppCompanyTemplate(type).sections.map((section, sortOrder) => ({
    sectionKey: section.key,
    isVisible: section.visible,
    displayStyle: section.style,
    sortOrder,
  }));
}

export function templateTypeFromExampleSlug(slug: string): CppCompanyPresentationType {
  switch (slug) {
    case "position-first":
      return "position_first";
    case "researcher-first":
      return "researcher_first";
    case "technology-first":
      return "research_first";
    case "culture-first":
      return "culture_first";
    case "challenge-first":
      return "challenge_first";
    default:
      return "culture_first";
  }
}
