import type {ServiceKind} from "./classBusinessModel";
import type {ApplicationField} from "./classBriefingWorkflow";
export type FlowKind=ServiceKind|"membership";
export type FlowStep="page"|"common"|"eligibility"|"booking"|"briefing"|"application"|"testBooking"|"test"|"result"|"approval"|"terms"|"class"|"payment"|"confirmation"|"onsite";
export type FlowDraft={
 audience:"everyone"|"members_only";route:"direct"|"briefing";confirmation:"automatic"|"review";
 terms:string;payment:"free"|"before"|"onsite"|"recurring";test:boolean;notes:Partial<Record<FlowStep,string>>;order?:FlowStep[];config?:Partial<Record<FlowStep,StepConfig>>;
};
export type FlowTarget={kind:FlowKind;id:string;title:string;priceText?:string;paid?:boolean;defaultPayment?:FlowDraft["payment"];classNames?:string[];audience?:"adult"|"minor"};
export const flowSteps:FlowStep[]=["page","common","eligibility","booking","briefing","application","testBooking","test","result","approval","terms","class","payment","confirmation","onsite"];
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
  return {audience:target.kind!=="membership"&&v.audience==="members_only"?"members_only":"everyone",route:v.route==="briefing"?"briefing":"direct",confirmation:v.confirmation==="review"?"review":v.confirmation==="automatic"?"automatic":base.confirmation,terms:typeof v.terms==="string"?v.terms.slice(0,8000):"",payment:target.paid===false?"free":target.paid===true&&v.payment==="free"?base.payment:allowed.includes(v.payment)?v.payment:base.payment,test:v.test===true,notes,config:parseStepConfigs(v.config),...(Array.isArray(v.order)&&v.order.every((s:unknown)=>flowSteps.includes(s as FlowStep))?{order:[...new Set<FlowStep>(v.order)]}: {})};
 }catch{return base;}
}
export function buildFlow(target:FlowTarget,draft:FlowDraft):FlowStep[]{
 const membership=target.kind==="membership";
 const payment=target.paid===false?"free":draft.payment;
 return ["page",...(!membership&&draft.audience==="members_only"?["eligibility" as const]:[]),...(draft.route==="briefing"?["booking","briefing"] as const:[]),"application",...(draft.test?["test" as const]:[]),...(draft.confirmation==="review"?["approval" as const]:[]),...(draft.terms.trim()?["terms" as const]:[]),...(target.kind==="course"?["class" as const]:[]),...(payment==="before"||payment==="recurring"?["payment" as const]:[]),"confirmation",...(payment==="onsite"?["onsite" as const]:[])];
}
export function stepLabel(step:FlowStep,target:FlowTarget,draft:FlowDraft){
 const member=target.kind==="membership";
 const labels:Record<FlowStep,string>={page:member?"入会案内":"募集ページ",common:"共通の入会手続き",eligibility:"会員資格確認",booking:"説明会予約",briefing:"説明会・体験",application:member?"入会申込":target.kind==="event"?"参加申込":"受講申込",testBooking:"テスト申込",test:"テスト",result:"合否判定",approval:member?"入会許可":"運営者の確認",terms:"規約同意",class:"開催枠選択",payment:draft.payment==="recurring"||target.defaultPayment==="recurring"?"月謝決済":member?"入会金決済":"事前決済",confirmation:member?"入会確定":target.kind==="event"?"参加確定":"受講確定",onsite:"当日払い"};
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
 if(order.includes("testBooking")&&!order.includes("test"))return "テスト申込にはテストの工程が必要です。";
 if(order.includes("result")&&!order.includes("test"))return "合否判定にはテストの工程が必要です。";
 if(!before("booking","briefing")||!before("testBooking","test")||!before("test","result")||!before("test","approval")||!before("result","approval"))return "予約・テスト申込は実施前、合否判定・承認はテスト後に置いてください。";
 if(!before("application","approval")||!before("application","class")||!before("application","payment")||!before("terms","payment")||!before("class","payment")||!before("approval","payment")||!before("result","payment")||!before("test","payment")||!before("common","payment"))return "申込・必要な確認・同意・開催枠選択を終えてから決済してください。";
 if(order.some(s=>s!=="confirmation"&&s!=="onsite"&&!before(s,"confirmation"))||!before("confirmation","onsite"))return "必要な手続きと事前決済の後に確定し、当日払いはその後にしてください。";
 return null;
}
export function moveFlowStep(order:FlowStep[],from:FlowStep,to:FlowStep):FlowStep[]{
 const a=order.indexOf(from),b=order.indexOf(to);if(a<0||b<0||a===b)return order;
 const next=[...order];next.splice(a,1);next.splice(b,0,from);return next;
}

/** Structured draft fields. No applicant responses or payment credentials are stored. */
export type FieldRule="required"|"optional"|"hidden";
export type StepConfig={mode?:string;audience?:"adult"|"minor";rules?:Partial<Record<ApplicationField,FieldRule>>;title?:string;subject?:string;body?:string;location?:string;date?:string;time?:string;duration?:number;maxScore?:number;passScore?:number;notify?:boolean;consent?:boolean;method?:string;url?:string;capacity?:number};
export const flowFieldIds:ApplicationField[]=["name","email","phone","address","school","guardianName","guardianEmail","guardianPhone","guardianAddress"];
export function formRules(config:StepConfig,audience:"adult"|"minor"){
 const rules={} as Record<ApplicationField,FieldRule>;
 for(const key of flowFieldIds){
  const rule=config.rules?.[key];
  rules[key]=key==="name"||key==="email"||audience==="minor"&&key.startsWith("guardian")?"required":audience==="adult"&&key.startsWith("guardian")?"hidden":rule==="required"||rule==="optional"||rule==="hidden"?rule:"hidden";
 }
 return rules;
}
export function parseStepConfigs(raw:unknown):FlowDraft["config"]{
 if(!raw||typeof raw!=="object")return {};
 const result:NonNullable<FlowDraft["config"]>={};
 for(const step of flowSteps){
  const value=(raw as Record<string,unknown>)[step];
  if(!value||typeof value!=="object")continue;
  const v=value as Record<string,unknown>,c:StepConfig={};
  for(const key of ["mode","title","subject","body","location","date","time","method","url"] as const){
   if(typeof v[key]==="string")c[key]=v[key].slice(0,key==="body"?4000:key==="url"?2000:300);
  }
  if(v.audience==="adult"||v.audience==="minor")c.audience=v.audience;
  for(const key of ["duration","maxScore","passScore","capacity"] as const)if(typeof v[key]==="number"&&Number.isFinite(v[key])&&Number.isInteger(v[key])&&v[key]>=0&&v[key]<=1000000)c[key]=v[key];
  for(const key of ["notify","consent"] as const)if(typeof v[key]==="boolean")c[key]=v[key];
  if(v.rules&&typeof v.rules==="object"){
   c.rules={};
   for(const key of flowFieldIds){const rule=(v.rules as Record<string,unknown>)[key];if(rule==="required"||rule==="optional"||rule==="hidden")c.rules[key]=rule;}
  }
  result[step]=c;
 }
 return result;
}
export function stepConfigIssue(step:FlowStep,c:StepConfig):string|null{
 if(step==="result"&&c.mode==="score"&&(!Number.isInteger(c.maxScore)||!Number.isInteger(c.passScore)||c.maxScore!<1||c.passScore!<0||c.passScore!>c.maxScore!))return "満点と合格点を確認してください。";
 if(step==="booking"||step==="testBooking"){
  if(c.mode==="scheduled"&&(!c.date||!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||!c.time||!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.time)))return "予約日時を入力してください。";
 }
 if(step==="payment"&&c.method==="external"){
  try{const u=new URL(c.url??"");if(u.protocol!=="https:"||u.username||u.password)return "HTTPSの決済URLを入力してください。";}catch{return "HTTPSの決済URLを入力してください。";}
 }
 return null;
}
