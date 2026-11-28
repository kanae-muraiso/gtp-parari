import type {ServiceKind} from "./classBusinessModel";
export type FlowKind=ServiceKind|"membership";
export type FlowStep="page"|"eligibility"|"booking"|"briefing"|"application"|"test"|"approval"|"terms"|"class"|"payment"|"confirmation"|"onsite";
export type FlowDraft={
 audience:"everyone"|"members_only";route:"direct"|"briefing";confirmation:"automatic"|"review";
 terms:string;payment:"free"|"before"|"onsite"|"recurring";test:boolean;notes:Partial<Record<FlowStep,string>>;
};
export type FlowTarget={kind:FlowKind;id:string;title:string;priceText?:string;paid?:boolean;defaultPayment?:FlowDraft["payment"];classNames?:string[]};
export const flowSteps:FlowStep[]=["page","eligibility","booking","briefing","application","test","approval","terms","class","payment","confirmation","onsite"];
export const flowKey=(school:string,target:Pick<FlowTarget,"kind"|"id">)=>"class-intake-design:"+school+":"+target.kind+":"+target.id;
export function initialFlow(target:FlowTarget):FlowDraft{
 return {audience:"everyone",route:"direct",confirmation:target.kind==="course"||target.kind==="membership"?"review":"automatic",terms:"",payment:target.defaultPayment??"free",test:false,notes:{}};
}
export function parseFlowDraft(raw:string|null,target:FlowTarget):FlowDraft{
 const base=initialFlow(target);
 try{
  const v=JSON.parse(raw??"null");
  if(!v||typeof v!=="object")return base;
  const notes:FlowDraft["notes"]={};
  for(const step of flowSteps)if(typeof v.notes?.[step]==="string"&&v.notes[step].length<=8000)notes[step]=v.notes[step];
  const allowed=["free","before","onsite",...(target.kind==="course"?["recurring"]:[])];
  return {audience:target.kind!=="membership"&&v.audience==="members_only"?"members_only":"everyone",route:v.route==="briefing"?"briefing":"direct",confirmation:v.confirmation==="review"?"review":v.confirmation==="automatic"?"automatic":base.confirmation,terms:typeof v.terms==="string"?v.terms.slice(0,8000):"",payment:allowed.includes(v.payment)?v.payment:base.payment,test:v.test===true,notes};
 }catch{return base;}
}
export function buildFlow(target:FlowTarget,draft:FlowDraft):FlowStep[]{
 const membership=target.kind==="membership";
 const payment=target.paid===false?"free":draft.payment;
 return ["page",...(!membership&&draft.audience==="members_only"?["eligibility" as const]:[]),...(draft.route==="briefing"?["booking","briefing"] as const:[]),"application",...(draft.test?["test" as const]:[]),...(draft.confirmation==="review"?["approval" as const]:[]),...(draft.terms.trim()?["terms" as const]:[]),...(target.kind==="course"?["class" as const]:[]),...(payment==="before"||payment==="recurring"?["payment" as const]:[]),"confirmation",...(payment==="onsite"?["onsite" as const]:[])];
}
export function stepLabel(step:FlowStep,target:FlowTarget,draft:FlowDraft){
 const member=target.kind==="membership";
 const labels:Record<FlowStep,string>={page:member?"入会案内":"募集ページ",eligibility:"会員資格確認",booking:"説明会予約",briefing:"説明会・体験",application:member?"入会申込":target.kind==="event"?"参加申込":"受講申込",test:"テスト",approval:member?"入会許可":"運営者の確認",terms:"規約同意",class:"開催枠選択",payment:draft.payment==="recurring"?"月謝決済":member?"入会金決済":"事前決済",confirmation:member?"入会確定":target.kind==="event"?"参加確定":"受講確定",onsite:"当日払い"};
 return labels[step];
}
