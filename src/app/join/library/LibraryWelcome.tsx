"use client";
import Link from "next/link";
import {useSearchParams} from "next/navigation";

const copy = {
 later: {icon:"▤",title:"この作品を、あとで読みませんか？",intro:"PARARIに無料登録すると、読みたい作品を自分のLIBRARYに残せます。",cta:"無料登録してあとで読む"},
 star: {icon:"☆",title:"気に入った作品を、あなたの書棚に",intro:"PARARIに無料登録すると、お気に入りの作品をいつでも見つけられます。",cta:"無料登録してお気に入りに"},
 save: {icon:"▤",title:"この作品を保存しませんか？",intro:"PARARIに無料登録すると、この作品を自分のLIBRARYからいつでも読み返せます。",cta:"無料登録して保存する"},
 follow: {icon:"♡",title:"この作者のファンになりませんか？",intro:"PARARIに無料登録すると、この作者の書棚があなたのLIBRARYに加わります。",cta:"無料登録してファンになる"},
} as const;
type Action=keyof typeof copy;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default function LibraryWelcome(){
 const params=useSearchParams();
 const workId=params.get("workId")||"";
 const authorId=params.get("authorId")||"";
 const raw=params.get("action")||"";
 const action=(Object.prototype.hasOwnProperty.call(copy,raw)?raw:"") as Action|"";
 const valid=uuid.test(workId)&&Boolean(action)&&(action!=="follow"||uuid.test(authorId));
 const details=action?copy[action]:null;
 const query=new URLSearchParams({libraryAction:action,workId});
 if(action==="follow")query.set("authorId",authorId);
 const returnTo="/p/"+encodeURIComponent(workId)+"?"+query.toString();
 const login="/login?returnTo="+encodeURIComponent(returnTo);
 return <main className="min-h-screen bg-neutral-50 px-4 py-10"><div className="mx-auto max-w-lg rounded-3xl border border-neutral-200 bg-white p-7 shadow-sm">
  <p className="text-center text-3xl" aria-hidden="true">{details?.icon||"▤"}</p>
  <h1 className="mt-3 text-center text-2xl font-bold">{details?.title||"作品の保存"}</h1>
  <p className="mt-4 text-center leading-7 text-neutral-700">{details?.intro||"作品のリンクを確認してください。"}</p>
  <ul className="mt-6 space-y-3 rounded-2xl bg-neutral-50 p-5 text-sm leading-6">
   <li>気になる作品を自分の書棚で整理できます。</li>
   <li>作者の作品や活動をいつでも確認できます。</li>
   <li>無料登録後、元の作品へ戻ります。</li>
  </ul>
  {valid?<Link href={login} className="mt-6 block rounded-xl bg-neutral-900 px-5 py-3 text-center font-semibold text-white">{details?.cta}</Link>
   :<p role="alert" className="mt-6 text-center text-sm text-red-700">作品へのリンクが正しくありません。</p>}
  <Link href={uuid.test(workId)?"/p/"+encodeURIComponent(workId):"/"} className="mt-4 block text-center text-sm text-neutral-600 underline">作品に戻る</Link>
  <p className="mt-5 text-center text-xs text-neutral-500">すでに会員の方も、同じボタンからログインできます。</p>
 </div></main>;
}
