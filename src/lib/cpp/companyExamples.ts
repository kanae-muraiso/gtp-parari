export type CompanyExampleSection = {
  title: string;
  lead?: string;
  paragraphs?: string[];
  bullets?: string[];
  stats?: Array<{ label: string; value: string }>;
};

export type CompanyExampleRecruitment = {
  title: string;
  subtitle?: string;
  tags: string[];
  summary: string;
  details: Array<{ label: string; value: string }>;
};

export type CompanyExample = {
  slug: string;
  typeNo: number;
  typeLabel: string;
  typeDescription: string;
  companyName: string;
  companyNameEn: string;
  industry: string;
  location: string;
  heroTitle: string;
  heroLead: string;
  accentWord: string;
  recommendedFor: string;
  openingLabel: string;
  sections: CompanyExampleSection[];
  recruitments: CompanyExampleRecruitment[];
  closingMessage: string;
};

export const COMPANY_EXAMPLES: CompanyExample[] = [
  {
    slug: "position-first",
    typeNo: 1,
    typeLabel: "募集ポジション型",
    typeDescription: "いま募集している仕事を最初に見せ、研究テーマと必要な専門性から会社を理解してもらう型。",
    companyName: "北斗バイオファーマ株式会社",
    companyNameEn: "HOKUTO BIOPHARMA, INC.",
    industry: "創薬・バイオ医薬品",
    location: "神奈川県横浜市",
    heroTitle: "あなたの研究を、次の治療へ。",
    heroLead: "北斗バイオファーマは、希少疾患と免疫疾患を対象に、抗体・細胞・データサイエンスを組み合わせた創薬を行っています。いま私たちが探しているのは、完成された『職種経験者』ではなく、自分の研究から問いを立てられる研究者です。",
    accentWord: "OPEN POSITIONS",
    recommendedFor: "募集職種が明確で、研究者に『今どんな仕事があるか』を最初に伝えたい企業",
    openingLabel: "現在募集中の研究ポジション",
    sections: [
      {
        title: "この仕事で解きたいこと",
        lead: "病態の理解から候補分子の選定までを一つのチームでつなぐ。",
        paragraphs: [
          "研究部門は、疾患生物学、抗体工学、トランスレーショナル研究、データサイエンスの4領域で構成されています。各領域の専門家が『自分の担当だけ』を見るのではなく、患者に届くまでの仮説を共同で組み立てます。",
          "博士課程で培った専門性そのものに加え、仮説が崩れたときに次の実験を設計できる力を重視しています。",
        ],
      },
      {
        title: "研究環境",
        stats: [
          { label: "研究者", value: "128名" },
          { label: "博士号保有", value: "72%" },
          { label: "共同研究", value: "国内外18機関" },
          { label: "研究費", value: "売上高の21%" },
        ],
      },
    ],
    recruitments: [
      {
        title: "抗体創薬研究員",
        subtitle: "Disease Biology × Antibody Engineering",
        tags: ["免疫学", "分子生物学", "抗体工学", "博士歓迎"],
        summary: "自己免疫疾患の新規標的探索から候補抗体の機能評価までを担当します。抗体研究の経験は必須ではありません。疾患生物学の強い専門性を歓迎します。",
        details: [
          { label: "対象", value: "博士号取得者・取得見込み" },
          { label: "勤務地", value: "横浜研究センター" },
          { label: "雇用", value: "正社員" },
          { label: "募集", value: "2名" },
        ],
      },
      {
        title: "トランスレーショナル・データサイエンティスト",
        subtitle: "Single Cell × Clinical Data",
        tags: ["バイオインフォマティクス", "single-cell", "統計", "Python/R"],
        summary: "single-cell解析と臨床データを接続し、患者層別化とバイオマーカー仮説をつくるポジションです。",
        details: [
          { label: "対象", value: "博士・ポスドク・同等の研究経験" },
          { label: "勤務地", value: "横浜／一部リモート" },
          { label: "雇用", value: "正社員" },
          { label: "募集", value: "1名" },
        ],
      },
    ],
    closingMessage: "応募するかどうかを決める前に、まず研究の話をしませんか。CPPでは、正式応募前の情報交換も歓迎しています。",
  },
  {
    slug: "researcher-first",
    typeNo: 2,
    typeLabel: "求める研究者型",
    typeDescription: "職種名より先に『どんな専門家と出会いたいか』を示し、複数研究部門のニーズを並べる型。",
    companyName: "瑞穂メディカルサイエンス株式会社",
    companyNameEn: "MIZUHO MEDICAL SCIENCE CO., LTD.",
    industry: "医薬品・診断・ヘルスケア",
    location: "東京都・茨城県",
    heroTitle: "職種名では、あなたを探しきれない。",
    heroLead: "私たちが知りたいのは『何の職種を経験したか』より、『何を深く考えてきた研究者なのか』です。現在、4つの研究ユニットがそれぞれ異なる専門性を持つ博士との出会いを求めています。",
    accentWord: "WHO WE SEEK",
    recommendedFor: "研究所や部門ごとに必要な専門性が違い、職種名だけでは募集内容を表しにくい企業",
    openingLabel: "いま会いたい研究者",
    sections: [
      {
        title: "炎症・免疫研究ユニット",
        lead: "慢性炎症を『細胞集団の状態遷移』として捉えたい。",
        bullets: ["免疫細胞の分化・活性化を研究してきた方", "組織免疫・single-cell解析の経験を持つ方", "疾患モデルから臨床仮説へ橋を架けたい方"],
      },
      {
        title: "創薬化学・ケミカルバイオロジーユニット",
        lead: "化合物を作る人だけでなく、化合物で生命現象を問える人を探しています。",
        bullets: ["有機合成・天然物・ケミカルバイオロジー", "タンパク質分解・共有結合性化合物", "構造活性相関を生物学と往復できる方"],
      },
      {
        title: "製剤・DDS研究ユニット",
        lead: "薬を『作る』だけでなく、『届かせる』ことを研究課題として楽しめる方へ。",
        bullets: ["高分子・コロイド・脂質ナノ粒子", "薬物動態・組織分布", "製剤プロセス・物性評価"],
      },
      {
        title: "デジタルバイオロジーユニット",
        lead: "データ解析を支援業務ではなく、仮説創出の研究として位置づけています。",
        bullets: ["機械学習・統計モデリング", "オミクス解析", "画像解析・病理AI"],
      },
    ],
    recruitments: [
      {
        title: "研究者オープンエントリー",
        tags: ["博士", "ポスドク", "専門性重視", "部門横断"],
        summary: "上記のどれかに完全一致する必要はありません。あなたの研究テーマを読んだ上で、最も近い研究ユニットとの面談を設定します。",
        details: [
          { label: "対象", value: "博士号取得者・取得予定者" },
          { label: "勤務地", value: "東京／つくば" },
          { label: "選考", value: "研究ディスカッションから開始" },
          { label: "募集", value: "複数名" },
        ],
      },
    ],
    closingMessage: "『自分の専門は募集職種名に当てはまらない』と思った方ほど、研究概要を見せてください。そこから対話を始めます。",
  },
  {
    slug: "technology-first",
    typeNo: 3,
    typeLabel: "研究・技術型",
    typeDescription: "自社のコア技術や研究テーマを先に示し、その技術を次へ進める博士を募集する型。",
    companyName: "青藍マテリアルズ株式会社",
    companyNameEn: "SEIRAN MATERIALS CORPORATION",
    industry: "先端材料・化学・エネルギー",
    location: "滋賀県大津市",
    heroTitle: "分子から、社会の材料をつくる。",
    heroLead: "青藍マテリアルズは、高分子設計、界面制御、計算材料科学を基盤に、次世代電池・分離膜・バイオマテリアルを開発しています。製品紹介ではなく、私たちがどんな科学を武器にしているかからご紹介します。",
    accentWord: "OUR SCIENCE",
    recommendedFor: "研究開発の厚みやコア技術そのものが採用上の魅力になるメーカー・R&D企業",
    openingLabel: "3つのコア技術",
    sections: [
      {
        title: "01｜分子設計",
        lead: "モノマー設計から高次構造までをつなぐ。",
        paragraphs: ["重合反応、自己組織化、刺激応答性材料を一つの研究基盤として扱い、要求物性から分子構造へ逆算する材料設計を進めています。"],
      },
      {
        title: "02｜界面・輸送現象",
        lead: "材料の性能は、境界面で決まる。",
        paragraphs: ["固液界面・高分子界面・ナノ細孔における輸送現象を計測とシミュレーションの両方から理解し、電池・膜・医療材料へ展開しています。"],
      },
      {
        title: "03｜計算材料科学",
        lead: "実験データを蓄積するだけでなく、次の実験を選ぶ。",
        paragraphs: ["分子シミュレーション、ベイズ最適化、材料インフォマティクスを研究プロセスに組み込み、探索の速度と解釈可能性を同時に高めています。"],
      },
      {
        title: "いま解こうとしている研究課題",
        bullets: ["全固体電池における界面抵抗の低減", "CO₂分離膜の選択性と耐久性の両立", "生体内で分解・再構成する高分子材料", "実験科学者が使える材料探索AI"],
      },
    ],
    recruitments: [
      {
        title: "材料研究職｜高分子・界面・計算科学",
        tags: ["高分子", "物理化学", "計算科学", "材料工学"],
        summary: "特定製品の担当者ではなく、コア技術を育てる研究者を募集します。現在の専門領域と配属テーマは必ずしも一致している必要はありません。",
        details: [
          { label: "対象", value: "博士号取得者・取得予定者" },
          { label: "勤務地", value: "大津中央研究所" },
          { label: "雇用", value: "正社員" },
          { label: "領域", value: "基礎～応用研究" },
        ],
      },
    ],
    closingMessage: "研究テーマの名前ではなく、どんな現象に面白さを感じ、どう解いてきたかを聞かせてください。",
  },
  {
    slug: "culture-first",
    typeNo: 4,
    typeLabel: "会社・文化型",
    typeDescription: "事業内容だけでなく、価値観・働き方・博士が活躍する理由から会社を理解してもらう型。",
    companyName: "NOVA Insight Japan株式会社",
    companyNameEn: "NOVA INSIGHT JAPAN K.K.",
    industry: "ヘルスケア・データ・コンサルティング",
    location: "東京都港区",
    heroTitle: "博士の『考える力』を、研究室の外へ。",
    heroLead: "NOVA Insightは、医療・製薬・公共分野の意思決定をデータと科学で支援する会社です。研究職の会社ではありません。しかし社員の約3割が博士号を持ち、問いを定義し、証拠を集め、議論を組み立てる力を仕事の中心に置いています。",
    accentWord: "HOW WE WORK",
    recommendedFor: "博士に馴染みの薄い業界・職種で、仕事の面白さや文化を丁寧に伝えたい企業",
    openingLabel: "博士が活躍する4つの理由",
    sections: [
      {
        title: "問いから始める",
        lead: "与えられた分析をするのではなく、何を明らかにすべきかを決める。",
        paragraphs: ["クライアントの依頼をそのまま作業に変換せず、意思決定に必要な問いへ翻訳するところからプロジェクトが始まります。"],
      },
      {
        title: "専門を越えてチームを組む",
        lead: "医学、統計、経済、工学、社会科学が同じテーブルにつく。",
        paragraphs: ["一人がすべてを知ることは期待されません。自分の専門を説明し、他分野の専門家と仮説を共有できることを重視します。"],
      },
      {
        title: "成果は論文ではなく意思決定",
        lead: "分析の美しさより、何が変わるか。",
        paragraphs: ["研究で培った厳密さを保ちながら、限られた時間と情報の中で意思決定につながる結論をつくります。"],
      },
      {
        title: "キャリアは一方向ではない",
        stats: [
          { label: "博士号保有", value: "31%" },
          { label: "出身分野", value: "20分野以上" },
          { label: "海外案件", value: "46%" },
          { label: "社内公募", value: "年2回" },
        ],
      },
    ],
    recruitments: [
      {
        title: "Healthcare Science Consultant",
        tags: ["博士歓迎", "データ解析", "医療", "コンサル未経験可"],
        summary: "製薬企業、医療機関、行政の課題を科学的に構造化し、調査・解析・提言までを担当します。コンサルティング経験は問いません。",
        details: [
          { label: "対象", value: "博士号取得者・取得予定者" },
          { label: "勤務地", value: "東京／ハイブリッド" },
          { label: "雇用", value: "正社員" },
          { label: "英語", value: "海外チームとの協働あり" },
        ],
      },
    ],
    closingMessage: "『研究を辞める』のではなく、研究で身につけた思考法を別の場所で使う。その選択肢を知ってほしいと思っています。",
  },
  {
    slug: "venture-first",
    typeNo: 5,
    typeLabel: "ベンチャー・挑戦型",
    typeDescription: "創業理由、まだ解けていない課題、少人数で挑む意味から入り、共に会社をつくる研究者を探す型。",
    companyName: "SeedArc Bio株式会社",
    companyNameEn: "SEEDARC BIO INC.",
    industry: "創薬スタートアップ",
    location: "京都府京都市",
    heroTitle: "治せない理由を、研究テーマにする。",
    heroLead: "SeedArc Bioは、難治性線維症の治療薬をつくるために2024年に生まれた研究ベンチャーです。社員18名、研究者12名。まだ大きな会社ではありません。だからこそ、一人の研究者の問いが会社の研究戦略そのものを変えます。",
    accentWord: "WHY WE EXIST",
    recommendedFor: "会社の知名度より、創業の理由・未解決課題・裁量の大きさを魅力として伝えたいスタートアップ",
    openingLabel: "私たちが会社をつくった理由",
    sections: [
      {
        title: "見えている標的だけでは治らなかった",
        paragraphs: ["大学で線維化研究を続ける中で、既知の経路を抑えるだけでは病態を止めきれない症例が多いことに気づきました。細胞外マトリクスの再編成そのものを治療標的として扱うため、大学発の研究チームからSeedArc Bioを立ち上げました。"],
      },
      {
        title: "まだ答えのない3つの問い",
        bullets: ["線維化が可逆性を失う境界はどこか", "病変組織だけに薬剤を届けるにはどうすればよいか", "患者ごとの進行速度を治療前に予測できるか"],
      },
      {
        title: "18人の会社で研究するということ",
        lead: "研究テーマの境界線が薄い。",
        paragraphs: ["細胞生物学の研究者が臨床医と患者選択を議論し、データサイエンティストが次の実験系を提案します。装置も人も大企業ほど多くありません。その代わり、研究上の判断が製品戦略まで直接つながります。"],
        stats: [
          { label: "社員", value: "18名" },
          { label: "研究者", value: "12名" },
          { label: "博士号保有", value: "10名" },
          { label: "共同研究", value: "5大学" },
        ],
      },
    ],
    recruitments: [
      {
        title: "Research Scientist｜Fibrosis Biology",
        tags: ["細胞生物学", "病理", "線維化", "創薬"],
        summary: "線維化の不可逆化を決める細胞状態を探索します。入社時点で創薬経験は問いません。自分の仮説を実験系へ落とし込める研究者を探しています。",
        details: [
          { label: "対象", value: "博士・ポスドク" },
          { label: "勤務地", value: "京都リサーチラボ" },
          { label: "雇用", value: "正社員" },
          { label: "募集", value: "1名" },
        ],
      },
      {
        title: "Research Scientist｜Spatial Biology",
        tags: ["空間オミクス", "画像解析", "病理", "Python/R"],
        summary: "組織内の細胞状態と薬剤応答を空間情報として解析し、患者層別化へつなげます。",
        details: [
          { label: "対象", value: "博士・同等の研究経験" },
          { label: "勤務地", value: "京都／一部リモート" },
          { label: "雇用", value: "正社員" },
          { label: "募集", value: "1名" },
        ],
      },
    ],
    closingMessage: "完成された会社に入るのではなく、研究と会社を一緒につくる。その不確実さを面白いと思う研究者と会いたいです。",
  },
];

export function getCompanyExample(slug: string) {
  return COMPANY_EXAMPLES.find((example) => example.slug === slug) ?? null;
}
