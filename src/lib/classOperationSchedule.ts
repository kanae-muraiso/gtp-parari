import type {SchoolClass} from "./classes";
import type {ClassEvent} from "./classEvents";
export type OperationSession={id:string;kind:"class"|"event"|"workshop";serviceId:string;title:string;startsAt:string;endsAt?:string;day:string;location:string|null;confirmed:boolean;sessionAt?:string};
export type OperationPerson={id:string;name:string;source:"fixed"|"reserved"|"recorded"|"event";absenceReported:boolean;actual:"present"|"absent"|null;payment?:string|null;ready?:boolean};
export type OperationMember={id:string;name:string;status:string;class_participation?:string|null;participation_mode?:string|null;assignments:{class_id:string;self_selected?:boolean}[]};
export function operationDay(at:string){return new Date(Date.parse(at)+9*3600000).toISOString().slice(0,10);}
export function classSession(item:SchoolClass,day:string,confirmed:boolean):OperationSession{
 const startsAt=new Date(day+"T"+item.starts_at.slice(0,5)+":00+09:00").toISOString();
 return {id:"class:"+item.id+":"+day,kind:"class",serviceId:item.id,title:(item.productName?item.productName+"・":"")+item.name,startsAt,endsAt:new Date(Date.parse(startsAt)+(item.duration_minutes??60)*60000).toISOString(),day,location:item.location,confirmed};
}
export function eventSessions(event:ClassEvent):OperationSession[]{
 if(event.status==="draft")return [];
 const items=event.class_event.sessions??[event.class_event];
 return items.flatMap((s,i)=>Number.isFinite(Date.parse(s.startsAt))?[{id:"event:"+event.id+":"+s.startsAt,kind:event.class_event.sessions?"workshop" as const:"event" as const,serviceId:event.id,title:event.title+(event.class_event.sessions?"（第"+(i+1)+"回）":""),startsAt:new Date(s.startsAt).toISOString(),sessionAt:s.startsAt,day:operationDay(s.startsAt),location:s.location,confirmed:true}]:[]);
}
export function nextOperationSession(sessions:OperationSession[],now:number){
 return [...sessions].filter(s=>Date.parse(s.startsAt)>=now||!!s.endsAt&&Date.parse(s.endsAt)>now).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt))[0]??null;
}
export function operationPeople(item:SchoolClass,classes:SchoolClass[],members:OperationMember[],bookings:{enrollment_id:string;makeup_id?:string|null;surcharge_yen?:number;surcharge_paid_at?:string|null}[],reports:{enrollment_id:string;absence_reported:boolean;actual:string|null}[],starts:Record<string,string>,day:string,historical:boolean):OperationPerson[]{
 const recorded=new Map(reports.map(r=>[r.enrollment_id,r]));
 const booked=new Map(bookings.map(b=>[b.enrollment_id,b]));
 return members.flatMap(m=>{
  const assigned=m.assignments.some(a=>a.class_id===item.id);
  const groupAssigned=classes.some(c=>c.product_id&&m.assignments.some(a=>a.class_id===c.id));
  const fixed=m.assignments.some(a=>a.class_id===item.id&&a.self_selected)||(m.class_participation!=="flexible"&&(assigned||m.participation_mode==="open"&&!groupAssigned&&!item.product_id));
  const b=booked.get(m.id),r=recorded.get(m.id);
  if(!r&&!b&&(historical||m.status!=="active"||!fixed||starts[m.id]&&day<starts[m.id]))return [];
  return [{id:m.id,name:m.name,source:b?"reserved" as const:r&&!fixed?"recorded" as const:"fixed" as const,absenceReported:r?.absence_reported===true,actual:r?.actual==="present"||r?.actual==="absent"?r.actual:null,payment:b&&Number(b.surcharge_yen)>0&&!b.surcharge_paid_at?"unpaid":null}];
 });
}
