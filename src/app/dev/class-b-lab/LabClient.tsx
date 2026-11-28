"use client";
import {useEffect,useState} from "react";
import {createQrVersion6M} from "@/lib/qr/qrVersion6M";
import {classEventEntryMatches,classEventEntryReady,classEventEntryAttendance,type ClassEventEntry,type ClassEventEntryFilter} from "@/lib/classEvents";
type Action="pay"|"fail"|"upgrade"|"cancel"|"class"|"fill"|"member"|"event"|"paid"|"unpaid"|"open"|"enterPaid"|"enterUnpaid"|"close"|"confirmCash"|"manualPresent"|"squareConnect"|"squareClass"|"squareFill"|"disconnectSquare"|"squareEvent";
const labels:Record<Action,string>={pay:"購入成功",fail:"決済失敗",upgrade:"5クラス追加",cancel:"解約",class:"クラスを追加",fill:"30人まで登録",member:"1人追加",event:"イベントを公開",paid:"入金済参加者を登録",unpaid:"未入金参加者を登録",open:"受付を開始",enterPaid:"入金済参加者が受付",enterUnpaid:"未入金参加者が受付",close:"受付を終了",confirmCash:"参加者Bの現金入金を確認",manualPresent:"参加者Bを手動で出席登録",squareConnect:"Square接続のみ（ダミー）",squareClass:"確認済Square月謝クラスを追加（ダミー）",squareFill:"Square月謝クラスに31人登録",disconnectSquare:"Square接続解除（ダミー）",squareEvent:"Square決済イベントを追加（定員100人）"};
type State={ordinaryClasses:number;squareClasses:number;ordinaryEvents:number;squareEvents:number;entries:ClassEventEntry[];plan:string;blocks:number;classes:number;members:number;events:number;paid:number;unpaid:number;attended:number;gate:boolean;receipt:{name:string;title:string;bookingId:string;checkedAt:string}|null;results:{action:Action;ok:boolean;message:string}[]};
const empty:State={ordinaryClasses:0,squareClasses:0,ordinaryEvents:0,squareEvents:0,entries:[],plan:"a",blocks:0,classes:0,members:0,events:0,paid:0,unpaid:0,attended:0,gate:false,receipt:null,results:[]};
const sequence:Action[]=["fail","pay","class","class","class","class","class","class","upgrade","class","fill","member","event","event","event","event","paid","unpaid","open","enterUnpaid","enterPaid","enterPaid","close","enterPaid"];
const button="min-h-12 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-base font-semibold disabled:opacity-50";
export default function LabClient(){
 const [actions,setActions]=useState<Action[]>([]),[state,setState]=useState<State>(empty),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function run(next:Action[]){
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/dev/class-b-lab",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({actions:next})});
   const data=await response.json();if(!response.ok||!data.ok)throw Error(data.message||"実行できませんでした。");
   setActions(next);setState(data);
  }catch(e){setError(e instanceof Error?e.message:"実行できませんでした。");}finally{setBusy(false);}
 }
 const operate=(action:Action)=>void run([...actions,action]);
 const groups=[["契約",["pay","fail","upgrade","cancel"]],["クラス",["class","fill","member"]],["イベント・入場",["event","paid","unpaid","open","enterUnpaid","enterPaid","close"]],["Square特例（すべて架空の決済情報）",["squareConnect","squareClass","squareFill","squareEvent","disconnectSquare"]]] as const;
 const [entranceUrl,setEntranceUrl]=useState("");
 const [filter,setFilter]=useState<ClassEventEntryFilter>("all"),[search,setSearch]=useState("");
 const visible=state.entries.filter(entry=>classEventEntryMatches(entry,"on_site",undefined,filter,search));
 useEffect(()=>{setEntranceUrl(new URL("/dev/class-b-lab/entrance",window.location.origin).href);},[]);
 let qr:boolean[][]=[];
 if(entranceUrl){try{qr=createQrVersion6M(entranceUrl);}catch{}}
 return <main className="min-h-screen bg-neutral-100 p-4 text-neutral-950"><article className="mx-auto grid max-w-3xl gap-4">
 <header className="rounded-2xl bg-emerald-900 p-5 text-white"><p className="text-sm font-bold tracking-wide">PARARI DEVELOPMENT LAB</p><h1 className="mt-2 text-2xl font-bold">CLASS B 操作テスト</h1><p className="mt-2 text-base">架空の教室と参加者を使用します。実際の課金・メール・本番DBへの接続はありません。</p></header>
 <section className="grid gap-3 rounded-2xl bg-white p-4"><h2 className="text-lg font-bold">利用状況</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["契約",state.plan==="b"?"CLASS B":"CLASS A"],["月額",state.blocks*1000+"円"],["通常クラス",state.ordinaryClasses+"/"+(state.plan==="b"?state.blocks*5:1)],["Squareクラス",state.squareClasses],["在籍枠",state.members+"/30"],["通常イベント",state.ordinaryEvents+"/3"],["Squareイベント",state.squareEvents],["入金済",state.paid],["未入金",state.unpaid],["出席",state.attended]].map(([name,value])=><div key={name} className="rounded-xl bg-neutral-50 p-3"><p className="text-base">{name}</p><strong className="text-xl">{value}</strong></div>)}</div></section>
 <section className="grid gap-2 rounded-2xl bg-white p-4"><button className="min-h-12 rounded-xl bg-emerald-700 p-3 text-base font-bold text-white disabled:opacity-50" disabled={busy} onClick={()=>void run(sequence)}>一連の運営テストを実行</button><button className={button} disabled={busy} onClick={()=>void run(["pay","class","class","class","class","class","squareConnect","class","squareClass","squareFill","event","event","event","event","squareEvent"])}>利用枠・Square特例の一連テスト</button><button className={button} disabled={busy} onClick={()=>void run([])}>最初からやり直す</button>{busy&&<p role="status">隔離DBで操作を実行中…</p>}{error&&<p role="alert" className="text-red-700">{error}</p>}</section>
 {groups.map(([name,items])=><section key={name} className="grid gap-3 rounded-2xl bg-white p-4"><h2 className="text-lg font-bold">{name}</h2><div className="grid gap-2 sm:grid-cols-2">{items.map(action=><button key={action} className={button} disabled={busy||actions.length>=60} onClick={()=>operate(action)}>{labels[action]}</button>)}</div></section>)}
 <section className="grid gap-3 rounded-2xl bg-white p-4">
 <h2 className="text-lg font-bold">イベント運営・参加者名簿</h2>
 <p className="text-base">申込 {state.entries.length}人 ／ 参加確定 {state.entries.filter(e=>classEventEntryReady(e,"on_site")).length}人 ／ 出席 {state.entries.filter(e=>classEventEntryAttendance(e)==="present").length}人</p>
 <label className="grid gap-1 text-base">氏名・申込番号<input className="min-h-11 rounded-lg border p-2" value={search} onChange={e=>setSearch(e.target.value)}/></label>
 <label className="grid gap-1 text-base">表示対象<select className="min-h-11 rounded-lg border p-2" value={filter} onChange={e=>setFilter(e.target.value as ClassEventEntryFilter)}><option value="all">全員</option><option value="ready">参加確定</option><option value="unpaid">未入金</option><option value="present">出席済み</option><option value="notPresent">未出席</option></select></label>
 <p className="text-sm">{visible.length} / {state.entries.length}人</p>
 {visible.map(e=><div key={e.id} className="grid gap-2 rounded-xl border p-3"><strong className="text-lg">{e.name}</strong><p className="text-base">{e.payment_status==="paid"?"入金済み":"未入金"} ／ {e.class_event_attendance==="present"?"出席":"未出席"}</p><p className="break-all text-sm">申込番号 {e.id}</p>
 {e.name==="ダミー参加者 B"&&e.payment_status==="unpaid"&&<button className={button} disabled={busy} onClick={()=>operate("confirmCash")}>現金の入金を記録</button>}
 {e.name==="ダミー参加者 B"&&e.payment_status==="paid"&&e.class_event_attendance!=="present"&&<button className={button} disabled={busy} onClick={()=>operate("manualPresent")}>手動で出席登録</button>}
 </div>)}
 {!visible.length&&<p className="text-base text-neutral-600">表示対象の参加者はいません。</p>}
 </section>
 {entranceUrl&&<section className="rounded-2xl bg-white p-4 text-center"><h2 className="text-lg font-bold">スマートフォンでQR受付を試す</h2>{qr.length>0&&<svg viewBox="0 0 49 49" className="mx-auto w-64" role="img" aria-label="テスト用QR" shapeRendering="crispEdges"><rect width="49" height="49" fill="white"/>{qr.flatMap((row,y)=>row.map((dark,x)=>dark?<rect key={x+":"+y} x={x+4} y={y+4} width="1" height="1"/>:null))}</svg>}<a href={entranceUrl} target="_blank" rel="noreferrer" className="block break-all p-3 text-base underline">受付テスト画面を開く</a><p className="text-sm">QRで参加者画面を開けます。端末間の名簿は同期しません。</p></section>}
 {state.receipt&&<section className="rounded-2xl bg-emerald-100 p-5 text-center text-emerald-950"><div className="mx-auto grid h-16 w-16 animate-pulse place-items-center rounded-full bg-emerald-700 text-4xl text-white motion-reduce:animate-none">✓</div><h2 className="mt-3 text-3xl font-bold">受付完了</h2><p className="text-xl">{state.receipt.name} 様</p><p>{state.receipt.title}</p><p>受付時刻 {new Date(state.receipt.checkedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</p><p className="break-all">申込番号 {state.receipt.bookingId}</p></section>}
 <section className="grid gap-2 rounded-2xl bg-white p-4"><h2 className="text-lg font-bold">操作結果</h2>{!state.results.length&&<p>操作を選択してください。</p>}{state.results.map((r,i)=><div key={i} className="border-t py-2 text-base"><strong>{r.ok?"✓":"－"} {labels[r.action]}</strong><p className={r.ok?"text-neutral-600":"text-red-700"}>{r.message}</p></div>)}</section>
 </article></main>;
}
