import type {ServiceKind} from "./classBusinessModel";
export type FlowKind=ServiceKind|"membership";
export type FlowStep="page"|"common"|"eligibility"|"booking"|"briefing"|"application"|"test"|"approval"|"terms"|"class"|"payment"|"confirmation"|"onsite";
export type FlowDraft={
 audience:"everyone"|"members_only";route:"direct"|"briefing";confirmation:"automatic"|"review";
 terms:string;payment:"free"|"before"|"onsite"|"recurring";test:boolean;notes:Partial<Record<FlowStep,string>>;order?:FlowStep[];
};
export type FlowTarget={kind:FlowKind;id:string;title:string;priceText?:string;paid?:boolean;defaultPayment?:FlowDraft["payment"];classNames?:string[]};
export const flowSteps:FlowStep[]=["page","common","eligibility","booking","briefing","application","test","approval","terms","class","payment","confirmation","onsite"];
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
  return {audience:target.kind!=="membership"&&v.audience==="members_only"?"members_only":"everyone",route:v.route==="briefing"?"briefing":"direct",confirmation:v.confirmation==="review"?"review":v.confirmation==="automatic"?"automatic":base.confirmation,terms:typeof v.terms==="string"?v.terms.slice(0,8000):"",payment:target.paid===false?"free":target.paid===true&&v.payment==="free"?base.payment:allowed.includes(v.payment)?v.payment:base.payment,test:v.test===true,notes,...(Array.isArray(v.order)&&v.order.every((s:unknown)=>flowSteps.includes(s as FlowStep))?{order:[...new Set<FlowStep>(v.order)]}: {})};
 }catch{return base;}
}
export function buildFlow(target:FlowTarget,draft:FlowDraft):FlowStep[]{
 const membership=target.kind==="membership";
 const payment=target.paid===false?"free":draft.payment;
 return ["page",...(!membership&&draft.audience==="members_only"?["eligibility" as const]:[]),...(draft.route==="briefing"?["booking","briefing"] as const:[]),"application",...(draft.test?["test" as const]:[]),...(draft.confirmation==="review"?["approval" as const]:[]),...(draft.terms.trim()?["terms" as const]:[]),...(target.kind==="course"?["class" as const]:[]),...(payment==="before"||payment==="recurring"?["payment" as const]:[]),"confirmation",...(payment==="onsite"?["onsite" as const]:[])];
}
export function stepLabel(step:FlowStep,target:FlowTarget,draft:FlowDraft){
 const member=target.kind==="membership";
 const labels:Record<FlowStep,string>={page:member?"入会案内":"募集ページ",common:"共通の入会手続き",eligibility:"会員資格確認",booking:"説明会予約",briefing:"説明会・体験",application:member?"入会申込":target.kind==="event"?"参加申込":"受講申込",test:"テスト",approval:member?"入会許可":"運営者の確認",terms:"規約同意",class:"開催枠選択",payment:draft.payment==="recurring"||target.defaultPayment==="recurring"?"月謝決済":member?"入会金決済":"事前決済",confirmation:member?"入会確定":target.kind==="event"?"参加確定":"受講確定",onsite:"当日払い"};
 return labels[step];
}

/** The checked list and the order are draft-only; never an authorization rule. */
export function availableFlowSteps(target:FlowTarget,membership:boolean):FlowStep[]{
 return flowSteps.filter(s=>s==="common"?membership&&target.kind!=="membership":s==="eligibility"?false:s==="class"?target.kind==="course":s==="payment"||s==="onsite"?target.paid!==false:true);
}
export function flowOrder(target:FlowTarget,draft:FlowDraft,membership:boolean):FlowStep[]{
 const allowed=availableFlowSteps(target,membership);
 const order=(draft.order??buildFlow(target,draft)).filter(s=>allowed.includes(s));
 // Qualification is inherited from Design and isn't a selectable procedure.
 return order;
}
export function requiredFlowSteps(target:FlowTarget):FlowStep[]{
 return ["page","application","confirmation"];
}
export function flowOrderIssue(target:FlowTarget,order:FlowStep[],membership:boolean,sharedConfigured:boolean):string|null{
 const allowed=availableFlowSteps(target,membership);
 const at=(s:FlowStep)=>order.indexOf(s);
 const before=(a:FlowStep,b:FlowStep)=>at(a)<0||at(b)<0||at(a)<at(b);
 if(new Set(order).size!==order.length||order.some(s=>!allowed.includes(s)))return "選べない工程が含まれています。";
 if(requiredFlowSteps(target).some(s=>!order.includes(s)))return "募集ページ・申込・確定は必要です。";
 if(order[0]!=="page")return "募集ページ・入会案内を最初にしてください。";
 if(target.paid===true&&Number(order.includes("payment"))+Number(order.includes("onsite"))!==1)return "有料サービスには事前決済か当日払いのいずれかが必要です。";
 if(order.includes("payment")&&order.includes("onsite"))return "事前決済と当日払いはどちらか一方を選択してください。";
 if(order.includes("common")&&!sharedConfigured)return "先に共通の入会手続きの工程を保存してください。";
 if(order.includes("booking")&&!order.includes("briefing"))return "説明会予約には説明会・体験の工程が必要です。";
 if(!before("booking","briefing")||!before("class","payment"))return "予約は説明会より前、開催枠選択は決済より前にしてください。";
 if(order.some(s=>s!=="confirmation"&&s!=="onsite"&&!before(s,"confirmation"))||!before("confirmation","onsite"))return "必要な手続きと事前決済の後に確定し、当日払いはその後にしてください。";
 return null;
}
export function moveFlowStep(order:FlowStep[],from:FlowStep,to:FlowStep):FlowStep[]{
 const a=order.indexOf(from),b=order.indexOf(to);if(a<0||b<0||a===b)return order;
 const next=[...order];next.splice(a,1);next.splice(b,0,from);return next;
}
