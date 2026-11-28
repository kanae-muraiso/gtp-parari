"use client";
import {useState} from "react";
import ClassRecruitmentOffers from "@/components/parari/manage/ClassRecruitmentOffers";
import type {ClassRecruitmentData} from "@/components/parari/manage/ClassRecruitmentPanel";
import type {ClassManagement,SchoolClass} from "@/lib/classes";
import {classRequest} from "@/lib/classRequests";
export default function ClassCourseRecruitmentPanel({product,classes,recruitment,onSaved,preview}:{product:NonNullable<ClassManagement["products"]>[number];classes:SchoolClass[];recruitment:ClassRecruitmentData|null;onSaved:()=>void;preview:boolean}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[editing,setEditing]=useState(false);
 const slots=classes.filter(c=>c.product_id===product.id);
 const ids=new Set(slots.map(c=>c.id));
 const linked=(recruitment?.offers??[]).filter(o=>o.class_ids.some(id=>ids.has(id)));
 const offers=linked.filter(o=>o.class_ids.length&&o.class_ids.every(id=>ids.has(id)));
 const mixed=linked.length!==offers.length;
 async function save(input:object){
  if(preview){setMessage("画面確認用です。実データへの保存・公開は行いません。");return false;}
  const x=input as {action?:string;classIds?:string[];id?:string};
  if(x.action!=="offer"||!x.classIds?.length||!x.classIds.every(id=>ids.has(id))||linked.some(o=>o.id===x.id&&!offers.includes(o))){setMessage("対象サービスの開催枠を確認してください。");return false;}
  setBusy(true);setMessage("");
  try{await classRequest("/recruitment",input);setMessage("保存しました。");onSaved();return true;}
  catch(e){setMessage(e instanceof Error?e.message:"保存できませんでした。");return false;}
  finally{setBusy(false);}
 }
 const props={classes:slots,products:[product],offers,busy,save,commonRoute:recruitment?.recruitment?.route??"direct" as const,commonAudience:recruitment?.recruitment?.audience??"adult" as const,commonInformation:recruitment?.recruitment?.information??""};
 return <section className="grid gap-4 rounded-xl border p-4">
  <h3 className="text-xl font-bold">{product.name} の申込導線</h3>
  <p className="text-base text-neutral-600">このサービスに含まれる開催枠だけを対象にします。現行の申込エンジンでは規約・決済・説明会予約枠は事業共通です。</p>
  {mixed&&<p className="rounded-lg bg-amber-50 p-3 text-base">複数コースを含む既存の募集があります。自動分割や変更はしません。既存の共通設定で確認できます。</p>}
  <ClassRecruitmentOffers {...props} singleCourse onEditingChange={setEditing}/>
  {!editing&&offers.length>0&&<ClassRecruitmentOffers {...props} singleCourse publicationOnly/>}
  {message&&<p role="status" className="text-base">{message}</p>}
 </section>;
}
