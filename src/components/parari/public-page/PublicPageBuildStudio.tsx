"use client";

import { useMemo, useState } from "react";

import type { PublicPagePattern } from "@/components/parari/public-page/PublicPageStrategyWizard";

type BuildStage = 2 | 3 | 4 | 5;

type QuestionKey =
  | "activity"
  | "audience"
  | "outcome"
  | "origin"
  | "value"
  | "welcome"
  | "about"
  | "next";

type Answers = Record<QuestionKey, string>;

const EMPTY_ANSWERS: Answers = {
  activity: "",
  audience: "",
  outcome: "",
  origin: "",
  value: "",
  welcome: "",
  about: "",
  next: "",
};

const QUESTIONS: Record<
  QuestionKey,
  {
    label: string;
    hint: string;
    placeholder: string;
  }
> = {
  activity: {
    label: "あなたは、何をしていますか？",
    hint: "肩書きではなくても構いません。一言か二言で。",
    placeholder:
      "例）毎週金曜の夜に、気軽に参加できるダンスの時間をつくっています。",
  },
  audience: {
    label: "どんな人に届けたいですか？",
    hint: "顔が浮かぶくらい具体的でも大丈夫です。",
    placeholder:
      "例）運動は得意ではないけれど、音楽に合わせて身体を動かしたい人。",
  },
  outcome: {
    label: "その人に、どうなってほしいですか？",
    hint: "大きな成果でなく、気持ちの変化でも構いません。",
    placeholder:
      "例）帰るころには、身体も気分も少し軽くなってほしい。",
  },
  origin: {
    label: "これを始めたきっかけは何ですか？",
    hint: "立派な理由でなくて大丈夫です。",
    placeholder:
      "例）自分自身が楽しく続けられる場所が欲しかったから。",
  },
  value: {
    label: "いちばん大切にしていることは何ですか？",
    hint: "一つだけ挙げるなら、何でしょう。",
    placeholder:
      "例）上手にできることより、楽しく続けられること。",
  },
  welcome: {
    label: "初めての人に、何を伝えておくと安心してもらえそうですか？",
    hint: "初めて来る人が心配しそうなことを考えてみます。",
    placeholder:
      "例）一人で来る方も多いので、初参加でも気にしなくて大丈夫です。",
  },
  about: {
    label: "あなたについて、一つ知ってもらうなら何ですか？",
    hint: "経歴全部ではなく、このページに関係することを一つ。",
    placeholder:
      "例）自分自身も最初はまったくの初心者でした。",
  },
  next: {
    label: "ページを見終えた人に、次に何をしてほしいですか？",
    hint: "リンク先ではなく、してほしい行動を書きます。",
    placeholder:
      "例）まず一度、気軽に参加してみてほしい。",
  },
};

const QUESTION_ORDER: Record<
  PublicPagePattern,
  QuestionKey[]
> = {
  "person-first": [
    "about",
    "activity",
    "origin",
    "value",
    "audience",
    "outcome",
    "welcome",
    "next",
  ],
  "offer-first": [
    "activity",
    "audience",
    "outcome",
    "value",
    "origin",
    "about",
    "welcome",
    "next",
  ],
  "story-first": [
    "origin",
    "value",
    "activity",
    "about",
    "audience",
    "outcome",
    "welcome",
    "next",
  ],
  "welcome-first": [
    "welcome",
    "audience",
    "outcome",
    "activity",
    "about",
    "value",
    "origin",
    "next",
  ],
};

const PATTERN_LABELS: Record<
  PublicPagePattern,
  string
> = {
  "person-first": "PERSON FIRST",
  "offer-first": "OFFER FIRST",
  "story-first": "STORY FIRST",
  "welcome-first": "WELCOME FIRST",
};

function ModelPage({
  pattern,
}: {
  pattern: PublicPagePattern;
}) {
  const sections =
    pattern === "person-first"
      ? [
          ["PERSON", "写真とあなたの名前"],
          ["HEADLINE", "最初のひとこと"],
          ["INTRO", "短い紹介"],
          ["ABOUT", "あなたについて"],
          ["ACTIVITY", "活動・作品・クラス"],
          ["ACTION", "次の一歩"],
        ]
      : pattern === "offer-first"
        ? [
            ["HEADLINE", "まず何ができるか"],
            ["INTRO", "誰のためのものか"],
            ["OFFER", "活動・作品・クラス"],
            ["ABOUT", "それをしている人"],
            ["STORY", "始めた理由"],
            ["ACTION", "次の一歩"],
          ]
        : pattern === "story-first"
          ? [
              ["STORY", "なぜ始めたのか"],
              ["HEADLINE", "物語の入口"],
              ["ABOUT", "その話をする人"],
              ["ACTIVITY", "考えが形になったもの"],
              ["ACTION", "共感した人の次の一歩"],
            ]
          : [
              ["WELCOME", "最初の安心"],
              ["HEADLINE", "初めての人への言葉"],
              ["INTRO", "どんな人に向いているか"],
              ["ABOUT", "迎える人"],
              ["ACTIVITY", "最初に見てほしいもの"],
              ["ACTION", "次の一歩"],
            ];

  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[34px] border-[5px] border-neutral-950 bg-white shadow-xl">
      <div className="min-h-[520px]">
        <div
          className={[
            "p-5",
            pattern === "story-first"
              ? "bg-neutral-950 text-white"
              : pattern === "welcome-first"
                ? "bg-[#ead0bd]"
                : pattern === "offer-first"
                  ? "bg-[#f0ebe3]"
                  : "bg-neutral-100",
          ].join(" ")}
        >
          <div className="text-[9px] font-black tracking-[0.2em] opacity-50">
            {PATTERN_LABELS[pattern]}
          </div>

          <div className="mt-5 space-y-3">
            {sections.map(([code, description], index) => (
              <div
                key={code}
                className={[
                  "rounded-2xl border p-3",
                  pattern === "story-first"
                    ? "border-neutral-700 bg-neutral-900"
                    : "border-black/10 bg-white/80",
                  index === 0 ? "min-h-[90px]" : "",
                ].join(" ")}
              >
                <div className="text-[8px] font-black tracking-[0.16em] opacity-40">
                  {code}
                </div>

                <div className="mt-2 text-[11px] font-bold">
                  {description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnswerNotes({
  answers,
}: {
  answers: Answers;
}) {
  const entries = (
    Object.keys(QUESTIONS) as QuestionKey[]
  ).filter((key) => answers[key].trim());

  if (entries.length === 0) {
    return (
      <div className="text-sm text-neutral-400">
        まだ素材メモはありません。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((key) => (
        <div
          key={key}
          className="rounded-2xl border border-neutral-200 bg-white p-3"
        >
          <div className="text-[9px] font-black tracking-[0.14em] text-neutral-400">
            {QUESTIONS[key].label}
          </div>

          <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-neutral-700">
            {answers[key]}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PublicPageBuildStudio({
  pattern,
  onBackToStrategy,
  onOpenLegacy,
}: {
  pattern: PublicPagePattern;
  onBackToStrategy: () => void;
  onOpenLegacy: () => void;
}) {
  const [stage, setStage] =
    useState<BuildStage>(2);

  const [questionIndex, setQuestionIndex] =
    useState(0);

  const [answers, setAnswers] =
    useState<Answers>(EMPTY_ANSWERS);

  const [headline, setHeadline] = useState("");
  const [lead, setLead] = useState("");
  const [body, setBody] = useState("");
  const [action, setAction] = useState("");

  const questionOrder =
    QUESTION_ORDER[pattern];

  const currentKey =
    questionOrder[
      Math.min(
        questionIndex,
        questionOrder.length - 1,
      )
    ];

  const currentQuestion =
    QUESTIONS[currentKey];

  const answeredCount = useMemo(
    () =>
      questionOrder.filter(
        (key) => answers[key].trim(),
      ).length,
    [answers, questionOrder],
  );

  const goNextQuestion = () => {
    if (
      questionIndex <
      questionOrder.length - 1
    ) {
      setQuestionIndex(
        (current) => current + 1,
      );
      return;
    }

    setStage(3);
  };

  const goPreviousQuestion = () => {
    if (questionIndex > 0) {
      setQuestionIndex(
        (current) => current - 1,
      );
    }
  };

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-[32px] bg-neutral-950 text-white shadow-lg">
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-black tracking-[0.22em] text-neutral-500">
                PARARI PAGE BUILD
              </div>

              <div className="mt-2 text-2xl font-black">
                {PATTERN_LABELS[pattern]}
              </div>

              <p className="mt-2 text-sm leading-7 text-neutral-400">
                考えることと、文章を書くことを分けて、
                一つずつページをつくります。
              </p>
            </div>

            <button
              type="button"
              onClick={onBackToStrategy}
              className="rounded-full border border-neutral-700 px-4 py-2 text-xs font-bold text-neutral-300 transition hover:bg-neutral-900"
            >
              戦略を選び直す
            </button>
          </div>

          <div className="mt-6 grid grid-cols-5 gap-1.5">
            {[
              [1, "STRATEGY"],
              [2, "MATERIALS"],
              [3, "LAYOUT"],
              [4, "WRITE"],
              [5, "PREVIEW"],
            ].map(([number, label]) => {
              const numericNumber =
                Number(number);

              const active =
                numericNumber === stage;

              const done =
                numericNumber < stage;

              return (
                <div
                  key={String(number)}
                  className={[
                    "rounded-xl px-2 py-2 text-center",
                    active
                      ? "bg-white text-neutral-950"
                      : done
                        ? "bg-neutral-800 text-neutral-300"
                        : "bg-neutral-900 text-neutral-600",
                  ].join(" ")}
                >
                  <div className="text-[9px] font-black">
                    {done ? "✓" : number}
                  </div>

                  <div className="mt-1 hidden text-[7px] font-black tracking-wide sm:block">
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {stage === 2 ? (
        <section className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-black tracking-[0.18em] text-neutral-400">
              MATERIAL {questionIndex + 1} /{" "}
              {questionOrder.length}
            </div>

            <div className="text-xs font-bold text-neutral-400">
              {answeredCount}件回答
            </div>
          </div>

          <div className="mx-auto max-w-2xl py-8 sm:py-12">
            <h2 className="text-2xl font-black leading-tight text-neutral-950 sm:text-3xl">
              {currentQuestion.label}
            </h2>

            <p className="mt-3 text-sm leading-7 text-neutral-500">
              {currentQuestion.hint}
            </p>

            <textarea
              value={answers[currentKey]}
              onChange={(event) =>
                setAnswers((current) => ({
                  ...current,
                  [currentKey]:
                    event.target.value,
                }))
              }
              rows={4}
              autoFocus
              className="mt-7 w-full rounded-3xl border border-neutral-300 bg-neutral-50 px-5 py-4 text-base leading-8 outline-none transition focus:border-neutral-700 focus:bg-white"
              placeholder={
                currentQuestion.placeholder
              }
            />

            <div className="mt-3 text-xs leading-6 text-neutral-400">
              ここでは文章にまとめなくて大丈夫です。
              思いついたことだけ書いてください。
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-5">
            <button
              type="button"
              onClick={goPreviousQuestion}
              disabled={questionIndex === 0}
              className="rounded-full px-4 py-2 text-sm font-bold text-neutral-500 disabled:opacity-30"
            >
              ← 前の質問
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={goNextQuestion}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-600"
              >
                あとで考える
              </button>

              <button
                type="button"
                onClick={goNextQuestion}
                className="rounded-full bg-neutral-950 px-5 py-2 text-sm font-black text-white"
              >
                {questionIndex ===
                questionOrder.length - 1
                  ? "モデルを見る"
                  : "次へ →"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {stage === 3 ? (
        <section className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
            <div>
              <div className="text-[10px] font-black tracking-[0.18em] text-neutral-400">
                MODEL LAYOUT
              </div>

              <h2 className="mt-3 text-2xl font-black leading-tight text-neutral-950 sm:text-3xl">
                この骨格に、
                <br />
                あなたのことばを入れていきます。
              </h2>

              <p className="mt-4 max-w-xl text-sm leading-7 text-neutral-500">
                まだ文章を書く必要はありません。
                まず「どこに何を書くのか」を見てください。
              </p>

              <div className="mt-7 rounded-3xl bg-neutral-50 p-4">
                <div className="text-xs font-black text-neutral-700">
                  集まった素材
                </div>

                <div className="mt-1 text-xs text-neutral-500">
                  {answeredCount} /{" "}
                  {questionOrder.length} 個
                </div>

                <div className="mt-4 max-h-[300px] overflow-auto pr-1">
                  <AnswerNotes answers={answers} />
                </div>
              </div>

              <div className="mt-7 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStage(2)}
                  className="rounded-full border border-neutral-300 px-5 py-3 text-sm font-bold text-neutral-600"
                >
                  ← 質問に戻る
                </button>

                <button
                  type="button"
                  onClick={() => setStage(4)}
                  className="rounded-full bg-neutral-950 px-6 py-3 text-sm font-black text-white"
                >
                  この構成で文章を入れる →
                </button>
              </div>
            </div>

            <div className="rounded-3xl bg-neutral-100 p-5">
              <ModelPage pattern={pattern} />
            </div>
          </div>
        </section>
      ) : null}

      {stage === 4 ? (
        <section className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-7">
            <div className="text-[10px] font-black tracking-[0.18em] text-neutral-400">
              WRITE IN PLACE
            </div>

            <h2 className="mt-3 text-2xl font-black text-neutral-950">
              集めた材料を見ながら、
              ページの中身を書きます。
            </h2>

            <p className="mt-2 text-sm leading-7 text-neutral-500">
              上手に全部使う必要はありません。
              必要なものだけ拾って、自分のことばにします。
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <aside className="rounded-3xl bg-neutral-50 p-4">
              <div className="text-xs font-black text-neutral-700">
                あなたが答えたこと
              </div>

              <div className="mt-4 max-h-[620px] overflow-auto pr-1">
                <AnswerNotes answers={answers} />
              </div>
            </aside>

            <div className="space-y-4">
              <label className="block rounded-3xl border border-neutral-200 p-4">
                <div className="text-[9px] font-black tracking-[0.18em] text-neutral-400">
                  HEADLINE
                </div>

                <div className="mt-2 text-sm font-bold text-neutral-900">
                  最初に目に入るひとこと
                </div>

                <textarea
                  value={headline}
                  onChange={(event) =>
                    setHeadline(event.target.value)
                  }
                  rows={2}
                  className="mt-3 w-full resize-none border-0 bg-transparent p-0 text-2xl font-black leading-tight outline-none"
                  placeholder="ここに、あなたのひとこと"
                />
              </label>

              <label className="block rounded-3xl border border-neutral-200 p-4">
                <div className="text-[9px] font-black tracking-[0.18em] text-neutral-400">
                  LEAD
                </div>

                <div className="mt-2 text-sm font-bold text-neutral-900">
                  もう少しだけ説明する
                </div>

                <textarea
                  value={lead}
                  onChange={(event) =>
                    setLead(event.target.value)
                  }
                  rows={3}
                  className="mt-3 w-full resize-none border-0 bg-transparent p-0 text-sm leading-7 outline-none"
                  placeholder="誰に、何を届けているのか。"
                />
              </label>

              <label className="block rounded-3xl border border-neutral-200 p-4">
                <div className="text-[9px] font-black tracking-[0.18em] text-neutral-400">
                  BODY
                </div>

                <div className="mt-2 text-sm font-bold text-neutral-900">
                  もっと知りたい人へ
                </div>

                <textarea
                  value={body}
                  onChange={(event) =>
                    setBody(event.target.value)
                  }
                  rows={10}
                  className="mt-3 w-full resize-none border-0 bg-transparent p-0 text-sm leading-8 outline-none"
                  placeholder="始めた理由、大切にしていること、あなた自身のことなど。"
                />
              </label>

              <label className="block rounded-3xl border border-neutral-200 p-4">
                <div className="text-[9px] font-black tracking-[0.18em] text-neutral-400">
                  ACTION
                </div>

                <div className="mt-2 text-sm font-bold text-neutral-900">
                  最後に、何をしてほしい？
                </div>

                <input
                  value={action}
                  onChange={(event) =>
                    setAction(event.target.value)
                  }
                  className="mt-3 w-full border-0 bg-transparent p-0 text-base font-bold outline-none"
                  placeholder="例）まず一度、気軽に参加してみてください。"
                />
              </label>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStage(3)}
                  className="rounded-full border border-neutral-300 px-5 py-3 text-sm font-bold text-neutral-600"
                >
                  ← モデルを見る
                </button>

                <button
                  type="button"
                  onClick={() => setStage(5)}
                  className="rounded-full bg-neutral-950 px-6 py-3 text-sm font-black text-white"
                >
                  完成イメージを見る →
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {stage === 5 ? (
        <section className="rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <div className="text-[10px] font-black tracking-[0.2em] text-neutral-400">
                PREVIEW
              </div>

              <h2 className="mt-3 text-2xl font-black text-neutral-950">
                こんなページになります。
              </h2>
            </div>

            <div
              className={[
                "mt-8 overflow-hidden rounded-[36px] border border-neutral-200 shadow-lg",
                pattern === "story-first"
                  ? "bg-neutral-950 text-white"
                  : pattern === "welcome-first"
                    ? "bg-[#fbf4ed]"
                    : pattern === "offer-first"
                      ? "bg-[#f3eee7]"
                      : "bg-white",
              ].join(" ")}
            >
              <div className="p-7 sm:p-12">
                <div className="text-[9px] font-black tracking-[0.2em] opacity-40">
                  {PATTERN_LABELS[pattern]}
                </div>

                <h1 className="mt-5 whitespace-pre-wrap text-3xl font-black leading-tight sm:text-5xl">
                  {headline.trim() ||
                    "ここに、最初のひとこと。"}
                </h1>

                <div className="mt-6 max-w-2xl whitespace-pre-wrap text-sm leading-8 opacity-70">
                  {lead.trim() ||
                    "ここに短い紹介が入ります。"}
                </div>

                <div className="my-9 h-px bg-current opacity-10" />

                <div className="max-w-2xl whitespace-pre-wrap text-sm leading-8 opacity-80">
                  {body.trim() ||
                    "ここに、あなた自身のことばで書いた本文が入ります。"}
                </div>

                <div className="mt-10 inline-flex rounded-full bg-neutral-950 px-6 py-3 text-sm font-black text-white">
                  {action.trim() ||
                    "次の一歩"}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setStage(4)}
                className="rounded-full bg-neutral-950 px-6 py-3 text-sm font-black text-white"
              >
                ← 文章を直す
              </button>

              <button
                type="button"
                onClick={() => {
                  setStage(2);
                  setQuestionIndex(0);
                }}
                className="rounded-full border border-neutral-300 px-5 py-3 text-sm font-bold text-neutral-600"
              >
                質問から見直す
              </button>
            </div>

            <div className="mt-8 rounded-3xl bg-neutral-50 p-5 text-center">
              <div className="text-sm font-black text-neutral-900">
                ここまでが、今回つくる議論用の土台です。
              </div>

              <p className="mt-2 text-xs leading-6 text-neutral-500">
                質問の保存方法、文章フィールド、
                クラス・作品・予約などの配置は、
                この流れを触ってから決めます。
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="text-right">
        <button
          type="button"
          onClick={onOpenLegacy}
          className="text-xs font-bold text-neutral-400 hover:text-neutral-700"
        >
          現在の詳細設定を開く（確認用）
        </button>
      </div>
    </section>
  );
}
