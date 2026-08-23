"use client";

import { useState } from "react";

export type PublicPagePattern =
  | "person-first"
  | "offer-first"
  | "story-first"
  | "welcome-first";

export const PUBLIC_PAGE_PATTERN_LABELS:
  Record<PublicPagePattern, string> = {
    "person-first": "PERSON FIRST",
    "offer-first": "OFFER FIRST",
    "story-first": "STORY FIRST",
    "welcome-first": "WELCOME FIRST",
  };

type Purpose =
  | "join"
  | "know"
  | "read"
  | "contact"
  | "connect"
  | "other";

type Audience =
  | "new"
  | "known"
  | "specific"
  | "broad";

type FirstImpact =
  | "person"
  | "offer"
  | "ease"
  | "story"
  | "trust"
  | "now";

type Props = {
  displayName: string;
  bio: string;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  onStartEditing: (pattern: PublicPagePattern) => void;
};

const PURPOSES: Array<{
  id: Purpose;
  code: string;
  title: string;
  description: string;
}> = [
  {
    id: "join",
    code: "JOIN",
    title: "人に参加してほしい",
    description: "クラス、イベント、活動など",
  },
  {
    id: "know",
    code: "KNOW",
    title: "自分や活動を知ってほしい",
    description: "プロフィール、仕事、サービスなど",
  },
  {
    id: "read",
    code: "READ",
    title: "作品や文章を読んでほしい",
    description: "本、記事、制作物など",
  },
  {
    id: "contact",
    code: "CONTACT",
    title: "問い合わせてほしい",
    description: "相談、依頼、連絡など",
  },
  {
    id: "connect",
    code: "CONNECT",
    title: "人とつながりたい",
    description: "SNS、コミュニティ、継続的な関係など",
  },
  {
    id: "other",
    code: "OTHER",
    title: "その他の行動につなげたい",
    description: "あなた自身で目的を考えたい場合",
  },
];

const AUDIENCES: Array<{
  id: Audience;
  title: string;
  description: string;
}> = [
  {
    id: "new",
    title: "初めてあなたを知る人",
    description: "まだあなたのことをほとんど知らない人",
  },
  {
    id: "known",
    title: "すでにあなたを知っている人",
    description: "生徒、読者、顧客、知人など",
  },
  {
    id: "specific",
    title: "特定の目的を持っている人",
    description: "何かを探して、このページに来る人",
  },
  {
    id: "broad",
    title: "できるだけ幅広い人",
    description: "まず多くの人に活動を届けたい",
  },
];

const IMPACTS: Array<{
  id: FirstImpact;
  title: string;
  description: string;
}> = [
  {
    id: "person",
    title: "「この人だから」と思ってほしい",
    description: "人柄や魅力を最初に伝える",
  },
  {
    id: "offer",
    title: "「これをやってみたい」と思ってほしい",
    description: "活動、作品、サービスの魅力を先に伝える",
  },
  {
    id: "ease",
    title: "「自分にもできそう」と思ってほしい",
    description: "安心感や参加しやすさを先に伝える",
  },
  {
    id: "story",
    title: "「この考え方に共感する」と思ってほしい",
    description: "理由、背景、物語から伝える",
  },
  {
    id: "trust",
    title: "「この人なら信頼できそう」と思ってほしい",
    description: "人物、実績、活動を組み合わせて伝える",
  },
  {
    id: "now",
    title: "「今、行動しよう」と思ってほしい",
    description: "次にできることを分かりやすく提示する",
  },
];

const PATTERNS: Array<{
  id: PublicPagePattern;
  title: string;
  description: string;
  action: string;
}> = [
  {
    id: "person-first",
    title: "この人だから、を最初に",
    description:
      "写真・名前・短いメッセージから始め、人への興味を活動につなげます。",
    action: "この人についてもっと知る",
  },
  {
    id: "offer-first",
    title: "何ができるか、を最初に",
    description:
      "クラス・作品・サービスなど、相手にとっての価値を先に見せます。",
    action: "詳しく見る",
  },
  {
    id: "story-first",
    title: "なぜやっているか、を最初に",
    description:
      "考え方や物語から入り、共感した人を次の行動へつなげます。",
    action: "続きを読む",
  },
  {
    id: "welcome-first",
    title: "私にもできそう、を最初に",
    description:
      "初めての人の不安を減らし、安心して一歩進める構成です。",
    action: "はじめての方へ",
  },
];

function recommendPattern(
  impact: FirstImpact,
): PublicPagePattern {
  if (impact === "person" || impact === "trust") {
    return "person-first";
  }

  if (impact === "story") {
    return "story-first";
  }

  if (impact === "ease") {
    return "welcome-first";
  }

  return "offer-first";
}

function getRecommendationReason(
  impact: FirstImpact | null,
) {
  if (impact === "person") {
    return "あなたは「この人だから」と思ってもらうことを大切にしています。そこで、人物の魅力から活動へつなげる構成をおすすめします。";
  }

  if (impact === "trust") {
    return "まず信頼してもらうには、活動だけでなく「誰がやっているのか」が伝わることが大切です。人物を中心にした構成が合いそうです。";
  }

  if (impact === "story") {
    return "あなたは考え方や背景への共感を大切にしています。結論を急がず、物語から関係をつくる構成をおすすめします。";
  }

  if (impact === "ease") {
    return "最初の不安を取り除くことが重要そうです。「自分にもできそう」と感じてもらってから次の行動へつなげます。";
  }

  if (impact === "now") {
    return "今すぐ次の行動が分かることを重視しています。活動やサービスを先に見せ、行動への距離を短くする構成が合いそうです。";
  }

  return "あなたが届けたい価値を最初に見せることで、「これをもっと知りたい」という気持ちから次の行動へつなげます。";
}

function PhonePreview({
  pattern,
}: {
  pattern: PublicPagePattern;
  displayName: string;
  bio: string;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
}) {
  return (
    <div className="mx-auto w-[226px] overflow-hidden rounded-[32px] border-[5px] border-neutral-950 bg-white shadow-xl">
      <div className="relative h-[410px] overflow-hidden bg-white">

        {pattern === "person-first" ? (
          <div className="h-full">
            <div className="relative h-[185px] overflow-hidden bg-[#d8cab9]">
              <div className="absolute inset-0 bg-gradient-to-br from-[#c9b49d] via-[#e7ddd0] to-[#b9c6bb]" />

              <div className="absolute -bottom-8 right-5 h-32 w-24 rounded-t-full bg-[#efe7dd] opacity-90" />

              <div className="absolute bottom-4 left-4 rounded-full bg-white/90 px-2.5 py-1 text-[8px] font-black tracking-[0.16em] text-neutral-700">
                SAMPLE
              </div>
            </div>

            <div className="px-5 pb-5 pt-5">
              <div className="text-[8px] font-black tracking-[0.18em] text-neutral-400">
                MINA AOKI
              </div>

              <div className="mt-2 text-[22px] font-black leading-[1.15] text-neutral-950">
                この人となら、
                <br />
                続けられそう。
              </div>

              <p className="mt-3 text-[10px] leading-[1.75] text-neutral-600">
                からだを動かす時間を、
                もっと気軽に日常の中へ。
              </p>

              <div className="mt-4 flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-neutral-900" />

                <div>
                  <div className="text-[9px] font-bold text-neutral-900">
                    青木ミナ
                  </div>
                  <div className="text-[8px] text-neutral-400">
                    movement / workshop
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-full bg-neutral-950 px-3 py-2.5 text-center text-[9px] font-black text-white">
                この人の活動を見る
              </div>
            </div>
          </div>
        ) : null}

        {pattern === "offer-first" ? (
          <div className="h-full bg-[#f5f1ea] p-4">
            <div className="rounded-[24px] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-[8px] font-black tracking-[0.16em] text-[#8d735b]">
                  WEEKEND WORKSHOP
                </div>

                <div className="rounded-full bg-[#eee4d8] px-2 py-1 text-[7px] font-bold text-[#715b47]">
                  NEW
                </div>
              </div>

              <div className="mt-4 text-[23px] font-black leading-[1.12] text-neutral-950">
                週末の朝、
                <br />
                ちょっとだけ
                <br />
                自分を動かす。
              </div>

              <p className="mt-3 text-[10px] leading-[1.7] text-neutral-600">
                50分の小さなワークショップ。
                初めての方も歓迎です。
              </p>

              <div className="mt-4 rounded-2xl bg-[#ded4c8] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[8px] font-bold text-neutral-500">
                      NEXT
                    </div>
                    <div className="mt-1 text-[11px] font-black text-neutral-900">
                      SAT 10:30
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[8px] text-neutral-500">
                      KYOTO
                    </div>
                    <div className="mt-1 text-[10px] font-bold text-neutral-900">
                      ¥1,000
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-full bg-[#8a674c] px-3 py-2.5 text-center text-[9px] font-black text-white">
                詳しく見る
              </div>
            </div>

            <div className="mt-4 px-2 text-[8px] font-bold text-neutral-500">
              by 青木ミナ
            </div>
          </div>
        ) : null}

        {pattern === "story-first" ? (
          <div className="flex h-full flex-col bg-[#18201d] p-5 text-white">
            <div className="text-[8px] font-black tracking-[0.22em] text-[#a8b9ad]">
              MY STORY
            </div>

            <div className="mt-6 text-[25px] font-black leading-[1.16]">
              私が、
              <br />
              小さな場所で
              <br />
              続けている理由。
            </div>

            <div className="mt-5 h-px w-10 bg-[#82968a]" />

            <p className="mt-5 text-[10px] leading-[1.9] text-[#d0d9d3]">
              最初は自分のためでした。
              忙しい毎日の中で、
              少しだけ立ち止まれる時間が
              欲しかったのです。
            </p>

            <div className="mt-auto">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full border border-[#82968a] bg-[#303b35]" />

                <div>
                  <div className="text-[9px] font-bold">
                    青木ミナ
                  </div>
                  <div className="text-[7px] text-[#9dad9f]">
                    Kyoto
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-full border border-[#63756a] px-3 py-2.5 text-center text-[9px] font-black">
                続きを読む
              </div>
            </div>
          </div>
        ) : null}

        {pattern === "welcome-first" ? (
          <div className="h-full bg-[#fbf7f0] p-4">
            <div className="rounded-[24px] bg-[#e7b89a] p-5">
              <div className="text-[8px] font-black tracking-[0.18em] text-[#715042]">
                WELCOME
              </div>

              <div className="mt-4 text-[24px] font-black leading-[1.15] text-[#352a25]">
                はじめてでも、
                <br />
                ひとりでも、
                <br />
                大丈夫です。
              </div>

              <p className="mt-4 text-[10px] leading-[1.75] text-[#644d43]">
                上手にできる必要はありません。
                まず一度、遊びに来るような気持ちで。
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {[
                ["01", "初めての方が多いです"],
                ["02", "必要なものは少しだけ"],
                ["03", "一人での参加も歓迎"],
              ].map(([number, label]) => (
                <div
                  key={number}
                  className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm"
                >
                  <div className="text-[8px] font-black text-[#b67c5f]">
                    {number}
                  </div>

                  <div className="text-[9px] font-bold text-neutral-700">
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-full bg-[#5d4032] px-3 py-2.5 text-center text-[9px] font-black text-white">
              はじめての方へ
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}

export default function PublicPageStrategyWizard({
  displayName,
  bio,
  avatarUrl,
  coverImageUrl,
  onStartEditing,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [impact, setImpact] = useState<FirstImpact | null>(null);
  const [selectedPattern, setSelectedPattern] =
    useState<PublicPagePattern | null>(null);

  const recommendedPattern =
    impact ? recommendPattern(impact) : "person-first";

  const orderedPatterns = [
    ...PATTERNS.filter(
      (pattern) => pattern.id === recommendedPattern,
    ),
    ...PATTERNS.filter(
      (pattern) => pattern.id !== recommendedPattern,
    ),
  ];

  const reset = () => {
    setStep(1);
    setPurpose(null);
    setAudience(null);
    setImpact(null);
    setSelectedPattern(null);
  };

  return (
    <section className="overflow-hidden rounded-[32px] border border-neutral-200 bg-white shadow-sm">
      <div className="bg-neutral-950 px-5 py-7 text-white sm:px-8 sm:py-9">
        <div className="text-[10px] font-black tracking-[0.22em] text-neutral-400">
          PARARI PAGE STRATEGY
        </div>

        <h2 className="mt-3 max-w-2xl text-2xl font-black leading-tight sm:text-3xl">
          {step === 1
            ? "このページで、何を起こしたいですか？"
            : step === 2
              ? "誰に届けたいですか？"
              : step === 3
                ? "最初に、何を感じてほしいですか？"
                : "あなたには、この伝え方が合いそうです。"}
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-300">
          {step === 1
            ? "見た目からは始めません。まず、このページを見た人に何をしてほしいかを考えます。"
            : step === 2
              ? "同じ内容でも、誰に届けるかで伝える順番は変わります。"
              : step === 3
                ? "ファーストビューで何を感じてもらうかが、ページの設計を決めます。"
                : "回答から伝える順序を考えました。デザインではなく、まず伝え方を選びます。"}
        </p>
      </div>

      <div className="p-4 sm:p-6">
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className={[
                "h-1.5 flex-1 rounded-full",
                item <= step
                  ? "bg-neutral-900"
                  : "bg-neutral-200",
              ].join(" ")}
            />
          ))}
        </div>

        {step === 1 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {PURPOSES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setPurpose(item.id);
                  setStep(2);
                }}
                className="group rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-900 hover:bg-neutral-50"
              >
                <div className="text-[10px] font-black tracking-[0.18em] text-neutral-400">
                  {item.code}
                </div>

                <div className="mt-2 text-base font-black text-neutral-950">
                  {item.title}
                </div>

                <div className="mt-1 text-xs leading-5 text-neutral-500">
                  {item.description}
                </div>
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            {AUDIENCES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setAudience(item.id);
                  setStep(3);
                }}
                className="w-full rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-900 hover:bg-neutral-50"
              >
                <div className="text-base font-black text-neutral-950">
                  {item.title}
                </div>

                <div className="mt-1 text-xs leading-5 text-neutral-500">
                  {item.description}
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm font-bold text-neutral-500 hover:text-neutral-900"
            >
              ← 前の質問へ
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            {IMPACTS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  const recommended =
                    recommendPattern(item.id);

                  setImpact(item.id);
                  setSelectedPattern(recommended);
                  setStep(4);
                }}
                className="w-full rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-900 hover:bg-neutral-50"
              >
                <div className="text-base font-black text-neutral-950">
                  {item.title}
                </div>

                <div className="mt-1 text-xs leading-5 text-neutral-500">
                  {item.description}
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-sm font-bold text-neutral-500 hover:text-neutral-900"
            >
              ← 前の質問へ
            </button>
          </div>
        ) : null}

        {step === 4 ? (
          <div>
            <div className="mb-5 flex flex-wrap gap-2">
              {purpose ? (
                <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-600">
                  PURPOSE ✓
                </span>
              ) : null}

              {audience ? (
                <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-600">
                  AUDIENCE ✓
                </span>
              ) : null}

              {impact ? (
                <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-600">
                  FIRST IMPACT ✓
                </span>
              ) : null}
            </div>

            {orderedPatterns
              .filter(
                (pattern) =>
                  pattern.id === recommendedPattern,
              )
              .map((pattern) => (
                <section
                  key={pattern.id}
                  className="overflow-hidden rounded-[30px] border border-neutral-900 bg-neutral-950 text-white shadow-lg"
                >
                  <div className="grid gap-0 lg:grid-cols-[1fr_340px]">
                    <div className="flex flex-col justify-between p-6 sm:p-8">
                      <div>
                        <div className="inline-flex rounded-full bg-white px-3 py-1.5 text-[10px] font-black tracking-[0.14em] text-neutral-950">
                          PARARI おすすめ
                        </div>

                        <div className="mt-5 text-[10px] font-black tracking-[0.2em] text-neutral-400">
                          {PUBLIC_PAGE_PATTERN_LABELS[
                            pattern.id
                          ]}
                        </div>

                        <h3 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">
                          {pattern.title}
                        </h3>

                        <p className="mt-4 max-w-xl text-sm leading-7 text-neutral-300">
                          {pattern.description}
                        </p>

                        <div className="mt-6 rounded-2xl border border-neutral-700 bg-neutral-900 p-4">
                          <div className="text-[10px] font-black tracking-[0.16em] text-neutral-500">
                            WHY THIS PAGE?
                          </div>

                          <p className="mt-2 text-sm leading-7 text-neutral-200">
                            {getRecommendationReason(
                              impact,
                            )}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPattern(
                            pattern.id,
                          );
                          onStartEditing(
                            pattern.id,
                          );
                        }}
                        className="mt-7 w-full rounded-full bg-white px-6 py-3.5 text-sm font-black text-neutral-950 transition hover:bg-neutral-200 sm:w-auto"
                      >
                        この提案でページをつくる
                      </button>
                    </div>

                    <div className="flex items-center justify-center bg-neutral-100 px-4 py-7 text-neutral-950 sm:px-6">
                      <PhonePreview
                        pattern={pattern.id}
                        displayName={displayName}
                        bio={bio}
                        avatarUrl={avatarUrl}
                        coverImageUrl={coverImageUrl}
                      />
                    </div>
                  </div>
                </section>
              ))}

            <section className="mt-8">
              <div>
                <div className="text-lg font-black text-neutral-950">
                  他の伝え方もあります
                </div>

                <p className="mt-1 text-xs leading-6 text-neutral-500">
                  正解はひとつではありません。
                  PARARIの提案以外も見比べて、
                  自分らしい伝え方を選べます。
                </p>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {orderedPatterns
                  .filter(
                    (pattern) =>
                      pattern.id !==
                      recommendedPattern,
                  )
                  .map((pattern) => {
                    const selected =
                      selectedPattern === pattern.id;

                    return (
                      <button
                        key={pattern.id}
                        type="button"
                        onClick={() =>
                          setSelectedPattern(
                            pattern.id,
                          )
                        }
                        className={[
                          "overflow-hidden rounded-3xl border bg-white p-4 text-left transition",
                          selected
                            ? "border-neutral-950 ring-2 ring-neutral-950"
                            : "border-neutral-200 hover:border-neutral-500",
                        ].join(" ")}
                      >
                        <div className="text-[9px] font-black tracking-[0.16em] text-neutral-400">
                          {PUBLIC_PAGE_PATTERN_LABELS[
                            pattern.id
                          ]}
                        </div>

                        <div className="mt-2 text-base font-black leading-tight text-neutral-950">
                          {pattern.title}
                        </div>

                        <p className="mt-2 min-h-[48px] text-[11px] leading-5 text-neutral-500">
                          {pattern.description}
                        </p>

                        <div className="mt-4 flex h-[260px] justify-center overflow-hidden rounded-2xl bg-neutral-100 pt-4">
                          <div className="origin-top scale-[0.6]">
                            <PhonePreview
                              pattern={
                                pattern.id
                              }
                              displayName={
                                displayName
                              }
                              bio={bio}
                              avatarUrl={
                                avatarUrl
                              }
                              coverImageUrl={
                                coverImageUrl
                              }
                            />
                          </div>
                        </div>

                        <div className="mt-3 text-center text-[11px] font-bold text-neutral-600">
                          {selected
                            ? "この伝え方を選択中"
                            : "この伝え方を見る"}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </section>

            {selectedPattern &&
            selectedPattern !== recommendedPattern ? (
              <div className="mt-6 rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
                <div className="text-[10px] font-black tracking-[0.16em] text-neutral-400">
                  YOUR CHOICE
                </div>

                <div className="mt-2 text-base font-black text-neutral-950">
                  {
                    PUBLIC_PAGE_PATTERN_LABELS[
                      selectedPattern
                    ]
                  }
                </div>

                <p className="mt-2 text-xs leading-6 text-neutral-500">
                  PARARIのおすすめとは別の伝え方を選びました。
                  もちろん、この選択で進められます。
                </p>

                <button
                  type="button"
                  onClick={() =>
                    onStartEditing(
                      selectedPattern,
                    )
                  }
                  className="mt-4 rounded-full bg-neutral-950 px-6 py-3 text-sm font-black text-white transition hover:bg-neutral-700"
                >
                  このパターンでページをつくる
                </button>
              </div>
            ) : null}

            <div className="mt-6">
              <button
                type="button"
                onClick={reset}
                className="rounded-full px-5 py-3 text-sm font-bold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                ← 最初から考え直す
              </button>
            </div>

            <p className="mt-4 text-xs leading-6 text-neutral-400">
              現在はページ戦略を試す段階のため、
              この選択自体はまだ保存しません。
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
