"use client";
import React from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";

export default function FanWelcomePage(){
 const params=useSearchParams();
 const workId=params.get("workId")||"";
 const authorId=params.get("authorId")||"";
 const valid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
 const allowed=valid(workId)&&valid(authorId);
 const target=allowed?"/p/"+encodeURIComponent(workId)+"?followAuthor="+encodeURIComponent(authorId):"/";
 const login="/login?returnTo="+encodeURIComponent(target);
 return <main className="min-h-screen bg-neutral-50 px-4 py-10">
  <div className="mx-auto max-w-lg rounded-3xl border border-neutral-200 bg-white p-7 shadow-sm">
   <p className="text-center text-3xl" aria-hidden="true">♡</p>
   <h1 className="mt-3 text-center text-2xl font-bold">この作者のファンになりませんか？</h1>
   <p className="mt-4 text-center leading-7 text-neutral-700">PARARIに無料登録すると、この作者の書棚があなたのLIBRARYに加わります。</p>
   <ul className="mt-6 space-y-3 rounded-2xl bg-neutral-50 p-5 text-sm leading-6">
    <li>この作者の作品や活動をいつでも確認できます。</li>
    <li>新しい作品の公開も見つけやすくなります。</li>
    <li>気になる作品を自分の書棚に保存できます。</li>
   </ul>
   {allowed?<Link href={login} className="mt-6 block rounded-xl bg-neutral-900 px-5 py-3 text-center font-semibold text-white">無料登録してファンになる</Link>:<p className="mt-6 text-center text-sm text-red-700">作品へのリンクが正しくありません。</p>}
   <Link href={allowed?"/p/"+encodeURIComponent(workId):"/"} className="mt-4 block text-center text-sm text-neutral-600 underline">作品に戻る</Link>
   <p className="mt-5 text-center text-xs text-neutral-500">すでにアカウントがある方も、同じボタンからログインできます。</p>
  </div>
 </main>;
}
