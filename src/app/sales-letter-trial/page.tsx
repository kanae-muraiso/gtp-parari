"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Question = {
  title: string;
  question: string;
  hint: string;
  example: string;
  optional?: boolean;
};

const questions: Question[] = [
  {title:"誰のための商品か",question:"この商品・サービスは、どんな人のためのものですか？",hint:"年齢や職業だけでなく、今どんな状況にいる人かを書いてください。対象を広くしすぎなくても大丈夫です。",example:"例：以前から習い事に興味があったものの、最初の一歩を踏み出せない社会人"},
  {title:"商品名",question:"商品・サービスの名前は何ですか？",hint:"正式名称でも仮称でも構いません。初めて見た人に内容が伝わる名前か、後で確かめられます。",example:"例：初めての水彩画・少人数レッスン"},
  {title:"何を実現するか",question:"この商品で、お客様は何ができるようになりますか？",hint:"提供する内容ではなく、お客様が得る成果を一つ挙げてください。",example:"例：自分で簡単な風景画を描いて完成させられる"},
  {title:"どんな悩みに応えるか",question:"お客様は、今どんな悩みや不便を感じていますか？",hint:"実際にお客様から聞いた言葉があれば、そのまま書いてください。",example:"例：興味はあるが、道具の選び方も始め方もわからない"},
  {title:"約束する未来",question:"その悩みが解決したら、お客様の日常はどう変わりますか？",hint:"大げさな効果を約束せず、実際に期待できる変化を描いてください。",example:"例：週末に自分の作品を描く楽しみができる"},
  {title:"内容・方法",question:"具体的に何を、どんな方法で提供しますか？",hint:"回数、時間、場所、進め方、受け取れるものなど、サービスの骨格を書いてください。",example:"例：週1回90分、道具の使い方から少人数で練習"},
  {title:"なぜ解決できるか",question:"なぜ、その方法でお客様の悩みを解決できるのですか？",hint:"成果につながる仕組みや根拠を説明します。断定できないことは約束しないでください。",example:"例：基礎練習から小さな完成作品までを一回ずつ積み重ねるから"},
  {title:"他商品との差",question:"ほかの選択肢と比べて、どこに特徴がありますか？",hint:"他社を否定せず、人数、進め方、対象者など事実に基づいた違いを書いてください。",example:"例：初回から作品制作に取り組み、質問しやすい少人数制"},
  {title:"なぜ提供するのか",question:"あなたは、なぜこの商品やサービスを始めたのですか？",hint:"先生や作り手の経験、考え、大切にしていることを、自分の言葉で書きます。",example:"例：『描くことは楽しい』と感じる入口をもっと増やしたいから"},
  {title:"顧客の喜び",question:"実際のお客様から、どんな喜びの声が届いていますか？",hint:"まだ提供前なら空欄でも構いません。実在しない感想は作らないでください。",example:"例：初めて絵を完成させられた、という声",optional:true},
  {title:"専門家の評価",question:"第三者や専門家による評価・推薦はありますか？",hint:"資格、受賞、客観的な紹介などがあれば記入します。なければ無理に用意する必要はありません。",example:"例：講師の公的な指導資格、外部での紹介記事",optional:true},
  {title:"購入前の不安・疑問への回答",question:"申込前によく聞かれる疑問は何ですか？ どう答えますか？",hint:"料金、持ち物、初心者対応、キャンセルなど、申込をためらう理由を挙げます。",example:"例：道具を持っていない場合でも参加できますか？ → 初回は貸し出します"},
  {title:"選ばなかった場合の未来",question:"今のまま何もしなければ、どんな機会を逃す可能性がありますか？",hint:"不安をあおらず、お客様にとっての選択の意味を整理してください。",example:"例：興味を持ちながら、始めるきっかけがない状態が続く"},
  {title:"価格・購入条件",question:"料金と、申し込むための条件は何ですか？",hint:"税込価格、支払方法、回数、入会金、キャンセル条件などを整理します。未定なら未定と書いてください。",example:"例：月4回、税込8,000円。初回は体験参加から"},
  {title:"今選ぶ特典",question:"今申し込む理由や特典はありますか？",hint:"期限や特典は実際にある場合だけ記入。無理な限定販売は必要ありません。",example:"例：初回の道具レンタル無料。特典がなければ空欄",optional:true},
  {title:"イベント案内・連絡先登録",question:"興味を持った人に、次に何をしてもらいたいですか？",hint:"説明会、体験、予約、購入、お問い合わせなど、行動を一つ選び、その入口を明確にします。",example:"例：まず体験レッスンの空き日程を確認して申し込む"},
];
const sections = [
  {name:"お客様",start:0,end:4},
  {name:"商品と根拠",start:5,end:8},
  {name:"信頼と疑問",start:9,end:12},
  {name:"申込への案内",start:13,end:15},
];

export default function SalesLetterQuestionsTrial() {
  const [answers,setAnswers]=useState<string[]>(()=>Array(questions.length).fill(""));
  const [index,setIndex]=useState(0);
  const [review,setReview]=useState(false);
  const [copied,setCopied]=useState(false);
  const current=questions[index];
  const answered=answers.filter(value=>value.trim().length>0).length;
  const section=sections.find(item=>index>=item.start&&index<=item.end)?.name??"仕上げ";
  const summary=useMemo(()=>questions.map((question,i)=>
    String(i+1).padStart(2,"0")+"．"+question.title+"\n"+(answers[i].trim()||"（未記入）")
  ).join("\n\n"),[answers]);
  function update(value:string) {
    setAnswers(previous=>previous.map((item,i)=>i===index?value:item));
    setCopied(false);
  }
  function forward(){
    if(index===questions.length-1)setReview(true);
    else setIndex(value=>value+1);
  }
  function back(){
    if(review){setReview(false);return;}
    setIndex(value=>Math.max(0,value-1));
  }
  async function copyAnswers(){
    try {
      await navigator.clipboard.writeText("セールスレター設計の16の回答\n\n"+summary);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return <main className="min-h-screen bg-neutral-100 px-4 py-8 text-neutral-950 sm:px-6">
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm text-neutral-700 underline">← PARARIへ戻る</Link>
        <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-bold text-red-800">試用版・保存なし</span>
      </div>
      <section role="alert" className="mt-5 rounded-xl border-2 border-red-500 bg-red-50 p-4 text-red-900">
        <p className="font-bold">【重要】試用版です。回答は自動保存されません。</p>
        <p className="mt-2 text-sm leading-6">ページを閉じたり更新したりすると回答が消えます。実在するお客様の氏名・連絡先などの個人情報は入力しないでください。回答はこの画面内だけで扱い、公開・送信・決済は行いません。</p>
      </section>
      <header className="mt-8">
        <p className="text-xs font-bold tracking-widest text-emerald-800">PARARI WRITERS · セールスレター設計</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">商品の魅力を整理する16の質問</h1>
        <p className="mt-3 text-sm leading-7 text-neutral-700">一問ずつ答えていくと、誰に、何を、なぜ、どのように届けるのかが整理できます。今はセールスレターの文章には加工しません。答えにくい質問は飛ばして、後で戻っても大丈夫です。</p>
      </header>
      <div className="mt-6 flex flex-wrap gap-2">
        {sections.map(item=><span key={item.name} className={"rounded-full px-3 py-1.5 text-xs font-semibold "+(section===item.name&&!review?"bg-emerald-800 text-white":"bg-white text-neutral-600")}>{item.name}</span>)}
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full bg-emerald-700 transition-all" style={{width:((review?16:index+1)/16*100)+"%"}}/>
      </div>
      <div className="mt-3 flex justify-between gap-2 text-xs text-neutral-600">
        <span>{review?"全体の確認":section}</span>
        <span>{review?"全16問":String(index+1)+" / 16"} ・回答済み {answered}問</span>
      </div>
      <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7">
        {review?<div>
          <h2 className="text-xl font-bold">16の回答を確認する</h2>
          <p className="mt-2 text-sm text-neutral-600">ここは素材の整理までです。文章の組み立て、LP化、公開は別の工程にします。</p>
          <div className="mt-6 space-y-4">{questions.map((question,i)=><div key={i} className="rounded-xl border border-neutral-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold">{String(i+1).padStart(2,"0")}．{question.title}</h3>
              <button type="button" className="text-xs font-semibold text-emerald-800 underline" onClick={()=>{setIndex(i);setReview(false);}}>修正する</button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-neutral-700">{answers[i].trim()||"（未記入）"}</p>
          </div>)}</div>
          <button className="mt-6 rounded-full bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white" type="button" onClick={()=>void copyAnswers()}>
            回答の全文をコピー
          </button>
          {copied&&<p role="status" className="mt-2 text-sm text-emerald-800">コピーしました。必要ならご自身で保管してください。</p>}
        </div>:<div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">質問 {String(index+1).padStart(2,"0")}</span>
            {current.optional&&<span className="text-xs text-neutral-500">回答は任意</span>}
          </div>
          <h2 className="mt-4 text-xl font-bold">{current.title}</h2>
          <p className="mt-3 text-base font-semibold leading-8">{current.question}</p>
          <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-950">
            <p>{current.hint}</p>
            <p className="mt-2 text-xs text-emerald-800">{current.example}</p>
          </div>
          <label htmlFor="sales-answer" className="mt-6 block text-sm font-semibold">あなたの回答</label>
          <textarea id="sales-answer" rows={6} value={answers[index]} onChange={event=>update(event.target.value)}
            maxLength={5000} placeholder="思いつくままに書いてください。箇条書きでも大丈夫です。"
            className="mt-2 w-full resize-y rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm leading-7"/>
          <p className="mt-2 text-xs text-neutral-500">完成した文章を書く必要はありません。必要なら空欄のまま次へ進めます。</p>
        </div>}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-5">
          <button type="button" disabled={!review&&index===0} onClick={back}
            className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold disabled:opacity-40">← 戻る</button>
          {review?<button type="button" onClick={()=>{setReview(false);setIndex(0);}}
            className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold">最初から見直す</button>:
            <button type="button" onClick={forward}
              className="rounded-full bg-emerald-800 px-5 py-2.5 text-sm font-bold text-white">{index===15?"16の回答を確認する":"次へ →"}</button>}
        </div>
      </section>
      <p className="mt-6 text-center text-xs font-bold text-red-800">試用版：回答の自動保存・セールスレター生成・公開は行いません。</p>
    </div>
  </main>;
}
