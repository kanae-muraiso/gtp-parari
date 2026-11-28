import {NextRequest,NextResponse} from "next/server";
import {supabaseAdmin as db} from "@/lib/billing/supabaseAdmin";
import {classBusinessId,canManageClassStudio} from "@/lib/classBusinessScope";
import {classIdPattern,type SchoolClass} from "@/lib/classes";
import {generateClassDays,shiftCalendarMonth,classCalendarToday} from "@/lib/classCalendar";
import {classSession,eventSessions,operationPeople,type OperationMember,type OperationSession} from "@/lib/classOperationSchedule";
import type {ClassEvent} from "@/lib/classEvents";
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store",Vary:"Authorization"}});
const fail=(message:string,status=400)=>reply({ok:false,message},status);
const columns="id,product_id,name,starts_on,starts_at,cadence,location,delivery,duration_minutes,schedule_rules";
const dateShift=(day:string,n:number)=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
export async function GET(request:NextRequest){
 try{
  const token=request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const auth=token?await db.auth.getUser(token):null,user=auth?.data.user;
  const scope=request.nextUrl.searchParams.get("business");
  if(!user||auth?.error||!scope||!await canManageClassStudio(user.id))return fail("事業を確認してください。",404);
  const school=await classBusinessId(user.id,scope);
  if(!school)return fail("事業を確認してください。",404);
  const today=classCalendarToday(),start=dateShift(today,-30),end=dateShift(today,90);
  const [classRows,products]=await Promise.all([
   db.from("school_classes").select(columns).eq("school_id",school).limit(1000),
   db.from("school_class_products").select("id,name").eq("school_id",school).limit(1000)
  ]);
  if(classRows.error||products.error)throw classRows.error??products.error;
  if(classRows.data.length>=1000||products.data.length>=1000)return fail("開催枠の件数が上限を超えています。",409);
  const names=new Map(products.data.map(p=>[p.id,p.name]));
  const classes=(classRows.data as unknown as SchoolClass[]).map(c=>({...c,productName:names.get(c.product_id??"")}));
  const id=request.nextUrl.searchParams.get("class"),day=request.nextUrl.searchParams.get("day");
  if(id||day){
   if(!id||!classIdPattern.test(id)||!day||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(Date.parse(day)).toISOString().slice(0,10)!==day||day<start||day>end)return fail("開催日を確認してください。");
   const item=classes.find(c=>c.id===id);
   if(!item)return fail("開催枠を確認してください。",404);
   const schedule=await db.from("school_class_monthly_schedules").select("days,confirmed").eq("class_id",id).eq("month",day.slice(0,7)+"-01").maybeSingle();
   if(schedule.error)throw schedule.error;
   const scheduled=schedule.data?.days??generateClassDays(item,day.slice(0,7),false);
   if(!scheduled.includes(day))return fail("開催日ではありません。",409);
   const [members,bookings,reports,admissions]=await Promise.all([
    db.from("school_enrollments").select("id,name,status,class_participation,participation_mode,assignments:school_class_assignments(class_id,self_selected)").eq("school_id",school).limit(1000),
    db.from("school_class_visit_reservations").select("enrollment_id,makeup_id,surcharge_yen,surcharge_paid_at").eq("school_id",school).eq("class_id",id).eq("visit_on",day).limit(1000),
    db.from("school_attendance").select("enrollment_id,absence_reported,actual").eq("school_id",school).eq("class_id",id).eq("lesson_date",day).limit(1000),
    db.from("school_admission_cases").select("enrollment_id,starts_on").eq("school_id",school).not("enrollment_id","is",null).not("starts_on","is",null).limit(1000)
   ]);
   for(const result of [members,bookings,reports,admissions]){if(result.error)throw result.error;if(result.data.length>=1000)return fail("対象者の件数が上限を超えています。",409);}
   const starts:Record<string,string>={};
   for(const a of admissions.data){if(a.enrollment_id&&a.starts_on&&(!starts[a.enrollment_id]||a.starts_on<starts[a.enrollment_id]))starts[a.enrollment_id]=a.starts_on;}
   const session=classSession(item,day,schedule.data?.confirmed===true);
   return reply({ok:true,session,people:operationPeople(item,classes,members.data as OperationMember[],bookings.data,reports.data,starts,day,day<today),historical:day<today});
  }
  const [schedules,events]=await Promise.all([
   classes.length?db.from("school_class_monthly_schedules").select("class_id,month,days,confirmed").in("class_id",classes.map(c=>c.id)).gte("month",start.slice(0,7)+"-01").lte("month",end.slice(0,7)+"-01").limit(1000):Promise.resolve({data:[],error:null}),
   db.from("applications").select("id,title,description,status,class_event,definition,payment_method,payment_amount,payment_url").eq("class_event_school_id",school).is("archived_at",null).in("status",["open","closed"]).limit(1000)
  ]);
  if(schedules.error||events.error)throw schedules.error??events.error;
  if(schedules.data.length>=1000||events.data.length>=1000)return fail("開催予定の件数が上限を超えています。",409);
  const byKey=new Map(schedules.data.map(s=>[s.class_id+":"+s.month.slice(0,7),s]));
  const sessions:OperationSession[]=[];
  for(const item of classes)for(let month=start.slice(0,7);month<=end.slice(0,7);month=shiftCalendarMonth(month,1)){
   const saved=byKey.get(item.id+":"+month);
   for(const d of saved?.days??generateClassDays(item,month,false))if(d>=start&&d<=end)sessions.push(classSession(item,d,saved?.confirmed===true));
  }
  for(const event of events.data as unknown as ClassEvent[])if(event.class_event)for(const s of eventSessions(event))if(s.day>=start&&s.day<=end)sessions.push(s);
  sessions.sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)||a.id.localeCompare(b.id));
  return reply({ok:true,sessions,start,end});
 }catch{return fail("開催予定・参加者を取得できませんでした。",500);}
}
