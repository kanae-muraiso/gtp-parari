// Authenticated API regression tests with synthetic records; no live accounts or mail.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const root = path.resolve(__dirname,'..');
function load(relative,mocks={}) {
  const filename=path.join(root,relative), mod=new Module(filename,module);
  mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
  const original=mod.require.bind(mod);mod.require=name=>name in mocks?mocks[name]:original(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
  return mod.exports;
}
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const school=id(1), c1=id(2),c2=id(3),m1=id(4),m2=id(5),primary=id(6),child=id(7);
const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const day=new Date(Date.parse(today)+2*86400000).toISOString().slice(0,10);
const users={parent:{id:'parent',email:'parent@example.invalid',email_confirmed_at:day},child:{id:'child',email:'child@example.invalid',email_confirmed_at:day},stranger:{id:'stranger',email:'other@example.invalid',email_confirmed_at:day},unverified:{id:'parent',email:'parent@example.invalid'},reused:{id:'other-parent',email:'parent@example.invalid',email_confirmed_at:day}};
const members={parent:[{id:m1,name:'子1',role:'guardian',startsOn:day},{id:m2,name:'子2',role:'guardian',startsOn:day}],child:[{id:m1,name:'子1',role:'learner',startsOn:day}]};
const tables={
  school_admission_cases:[{id:id(8),school_id:school,name:'子1',applicant_email:users.parent.email,learner_email:users.child.email,applicant_audience:'minor',applicant_user_id:'parent',learner_user_id:null,registration_token:primary,learner_token:child,enrollment_id:m1,starts_on:day,decision:'approved'}],
  class_schools:[{id:school,name:'教室',owner_user_id:'teacher',archived_at:null}],profiles:[],
  school_enrollments:[{id:m1,school_id:school,name:'子1',status:'active',class_participation:'fixed',participation_mode:'assigned',assignments:[{class_id:c1,self_selected:false}]},{id:m2,school_id:school,name:'子2',status:'active',class_participation:'fixed',participation_mode:'assigned',assignments:[{class_id:c2,self_selected:false}]}],
  school_classes:[{id:c1,school_id:school,name:'子1クラス',starts_on:today,starts_at:'18:00',cadence:'weekly',location:'本校'},{id:c2,school_id:school,name:'子2クラス',starts_on:today,starts_at:'20:00',cadence:'weekly',location:'分校'}],
  school_class_monthly_schedules:[{class_id:c1,month:day.slice(0,7)+'-01',days:[today,day],confirmed:true},{class_id:c2,month:day.slice(0,7)+'-01',days:[day],confirmed:true}],
  school_recruitment:[{school_id:school,public_id:id(9)}], class_business_fronts:[{school_id:school,published:{}}],
  school_class_assignments:[{school_id:school,class_id:c1,enrollment_id:m1,self_selected:false}],
  school_class_products:[],school_class_product_designs:[],
  school_class_visit_reservations:[],school_class_makeups:[],school_attendance:[{school_id:school,enrollment_id:m1,class_id:c1,lesson_date:day,absence_reported:true}],
};
const calls=[];
const db={auth:{getUser:async token=>({data:{user:users[token]??null},error:null})},async rpc(name,args){calls.push({name,args});if(name==='school_class_runs_on') return {data:true,error:null}; if(name==='read_class_school_member') {
    const allowed=(members[args.p_actor]??[]).some(item=>item.id===args.p_member);
    const assigned=tables.school_enrollments.find(item=>item.id===args.p_member)?.assignments??[];
    return {data:allowed?{id:school,name:'教室',classes:tables.school_classes.filter(item=>assigned.some(a=>a.class_id===item.id))}:null,error:null};
  } return {data:null,error:null};},from(table){
  assert.ok(table in tables,table);let rows=tables[table];
  const chain={select(){return chain;},eq(k,v){rows=rows.filter(r=>r[k]===v);return chain;},is(k,v){rows=rows.filter(r=>(r[k]??null)===v);return chain;},in(k,v){rows=rows.filter(r=>v.includes(r[k]));return chain;},gte(k,v){rows=rows.filter(r=>r[k]>=v);return chain;},lt(k,v){rows=rows.filter(r=>r[k]<v);return chain;},lte(k,v){rows=rows.filter(r=>r[k]<=v);return chain;},order(){return chain;},limit(n){rows=rows.slice(0,n);return chain;},or(filter){const token=filter.split(',')[0].split('.').at(-1);rows=rows.filter(r=>r.registration_token===token||r.learner_token===token);return chain;},single(){return Promise.resolve({data:rows[0],error:null});},maybeSingle(){return Promise.resolve({data:rows[0]??null,error:null});},then(resolve){return Promise.resolve({data:rows,error:null}).then(resolve);}};return chain;
}};
const recurrence=load('src/lib/classRecurrence.ts');
const classes=load('src/lib/classes.ts',{'./classRecurrence':recurrence});
const calendar=load('src/lib/classCalendar.ts',{'./classes':classes,'./classRecurrence':recurrence,'@/lib/classes':classes});
const common={'@/lib/billing/supabaseAdmin':{supabaseAdmin:db},'@/lib/classes':classes,'@/lib/classCalendar':calendar,'@/lib/classRecurrence':recurrence,'@/lib/classProduct':load('src/lib/classProduct.ts'),'@/lib/classCalendarAccess':{classParticipantMembers:async(user,s)=>s===school?(members[user]??[]):[]},'@/lib/classBusinessScope':{classBusinessId:async()=>null,canManageClassStudio:async()=>false},'@/lib/classFeatureAccess':{classFeatureAccess:async()=>({canManage:false,canCreateEvents:false,plan:'a'})}};
const portal=load('src/app/api/classes/route.ts',common);
const registration=load('src/app/api/classes/registration/route.ts',{...common,'@/lib/classEnrollmentNotice':{classApplicationReturn:async()=>'/class-intake/test',sendClassEnrollmentNotice:async()=>true}});
const schedule=load('src/app/api/classes/schedule/route.ts',common);
const front=load('src/app/api/classes/front-participation/route.ts',common);
const attendance=load('src/app/api/classes/attendance/route.ts',common);
const req=(url,user,body,token)=>new NextRequest('https://www.parari.app'+url,{method:body?'POST':'GET',headers:{...(user?{Authorization:'Bearer '+user}:{}),...(token?{'x-class-registration':token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
async function main(){
  const messages=[];
  const enrollmentNotice=load('src/lib/classEnrollmentNotice.ts',{
    ...common,'server-only':{},
    '@/lib/classBusinessFront':{classBusinessFrontPath:school=>'/class-business/'+school},
    '@/lib/classIntakeSource':{readClassIntakeSource:async key=>key===id(9)?{recruitment:{school_id:school}}:null},
    '@/lib/classRegistrationMail':{classRegistrationMail:async (...args)=>{messages.push(args);return true;}},
  });
  assert.equal(await enrollmentNotice.classApplicationReturn(school),'/class-intake/'+id(9));
  assert.equal(await enrollmentNotice.classApplicationReturn(school,id(10)),'/class-business/'+school);
  await enrollmentNotice.sendClassEnrollmentNotice(school,id(8),'https://www.parari.app');
  assert.ok(messages[0][4].includes(day+' 18:00') && messages[0][4].includes('本校') && messages[0][4].includes('/my/classes/'+school));
  tables.school_enrollments[0].class_participation='flexible';
  await enrollmentNotice.sendClassEnrollmentNotice(school,id(8),'https://www.parari.app');
  assert.match(messages[1][4],/参加する回を予約/);
  assert.ok(!messages[1][4].includes(day+' 18:00'));
  tables.school_enrollments[0].class_participation='fixed';
  assert.equal((await registration.GET(req('/api/classes/registration',null,null,primary))).status,401);
  assert.equal((await registration.GET(req('/api/classes/registration','unverified',null,primary))).status,401);
  for(const [user,token] of [['stranger',primary],['child',primary],['parent',child],['reused',primary]]) {
    const res=await registration.GET(req('/api/classes/registration',user,null,token));assert.equal(res.status,404);assert.equal((await res.json()).name,undefined);
  }
  assert.equal((await registration.GET(req('/api/classes/registration','parent',null,primary))).status,200);
  assert.equal((await registration.POST(req('/api/classes/registration','child',{agree:true},child))).status,200);
  assert.equal(calls.at(-1).args.p_user,'child');assert.equal(calls.at(-1).name,'connect_and_complete_class_registration');
  for(const user of ['parent','child']) {
    const result=await portal.GET(req(`/api/classes?school=${school}&member=${m1}`,user));
    assert.equal(result.status,200);const body=await result.json();assert.equal(body.memberId,m1);assert.deepEqual(body.school.classes.map(item=>item.id),[c1]);
  }
  assert.equal((await portal.GET(req(`/api/classes?school=${school}&member=${m2}`,'child'))).status,404);
  assert.equal((await portal.GET(req(`/api/classes?school=${school}`,'stranger'))).status,404);
  assert.equal((await portal.GET(req('/api/classes?businesses=1','parent'))).status,404);
  assert.equal((await portal.POST(req('/api/classes','parent',{action:'create',name:'権限なし'}))).status,404);
  const uri=`/api/classes/schedule?school=${school}&month=${day.slice(0,7)}`;
  assert.equal((await schedule.GET(req(uri,'stranger'))).status,404);
  assert.equal((await schedule.GET(req(uri+`&member=${m2}`,'child'))).status,404);
  assert.equal((await schedule.POST(req(`/api/classes/schedule?class=${c1}&business=${school}`,'parent',{action:'save',month:day.slice(0,7),days:[]}))).status,404);
  const childCalendar=await (await schedule.GET(req(uri+`&member=${m1}`,'parent'))).json();
  assert.deepEqual(childCalendar.entries.map(e=>[e.title,e.day,e.label]),[['子1クラス',day,'欠席連絡済み']]);
  assert.equal((await (await schedule.GET(req(uri,'parent'))).json()).entries.length,2);
  const frontUrl=`/api/classes/front-participation?school=${school}&member=${m2}`;
  assert.equal((await front.GET(req(frontUrl,'child'))).status,404);
  assert.equal((await (await front.GET(req(frontUrl,'parent'))).json()).memberId,m2);
  assert.equal((await front.POST(req(frontUrl,'parent',{action:'reserve',classId:c2,day}))).status,200);
  assert.equal(calls.at(-1).args.p_member,m2);assert.equal(calls.at(-1).args.p_actor,'parent');
  const before=calls.length;
  assert.equal((await front.POST(req(frontUrl,'child',{action:'reserve',classId:c2,day}))).status,404);assert.equal(calls.length,before);
  assert.equal((await front.POST(req(frontUrl,'parent',{action:'reserve',classId:c2,day:today}))).status,404);
  const absentUrl=`/api/classes/attendance?school=${school}&member=${m1}`;
  assert.equal((await attendance.POST(req(absentUrl,'parent',{classId:c1,day,absent:true}))).status,200);
  assert.equal(calls.at(-1).args.p_member,m1);
  assert.equal((await attendance.POST(req(absentUrl.replace(m1,m2),'child',{classId:c2,day,absent:true}))).status,400);
  assert.equal((await attendance.GET(req(absentUrl,'stranger'))).status,404);
  // Separate private account links go only to the corresponding verified recipients.
  const sent=[];
  const mail=load('src/lib/classRegistrationMail.ts',{'server-only':{},'@/lib/billing/supabaseAdmin':{supabaseAdmin:db},'@/lib/classAdmissionMail':{classNotice:async(to,subject,body,key)=>{sent.push({to,body,key});return true;}}});
  await mail.classRegistrationMail(school,id(8),'https://www.parari.app','案内','本文','key');
  assert.equal(sent.length,2);assert.deepEqual(sent[0].to,[users.parent.email]);assert.deepEqual(sent[1].to,[users.child.email]);
  assert.ok(sent[0].body.includes('#'+primary));assert.ok(!sent[0].body.includes('#'+child));assert.ok(sent[1].body.includes('#'+child));assert.ok(!sent[1].body.includes('#'+primary));
  console.log('PASS: ordinary learner/guardian access, verified identity links, child isolation, calendar scope, first-day limits, reservation authorization and private mail links.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
