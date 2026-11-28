import {NextRequest,NextResponse} from "next/server";
import {classBLabAvailable} from "@/lib/testing/classBLabAvailable";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
export async function POST(request:NextRequest){
 if(!classBLabAvailable())return NextResponse.json({ok:false},{status:404});
 try{
  const body=await request.json();
  if(!Array.isArray(body?.actions)||body.actions.length>60||body.actions.some((a:unknown)=>typeof a!=="string"))
    return NextResponse.json({ok:false,message:"操作数を確認してください。"},{status:400});
  const {runClassBLab,labActions}=await import("@/lib/testing/classBLab");
  if(body.actions.some((a:typeof labActions[number])=>!labActions.includes(a)))
    return NextResponse.json({ok:false,message:"不明な操作です。"},{status:400});
  return NextResponse.json({ok:true,...await runClassBLab(body.actions)},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("[CLASS B LAB]",error);return NextResponse.json({ok:false,message:"隔離テストの実行に失敗しました。"},{status:500});}
}

// Fixed, read-only deployment smoke test. Every request creates a fresh
// in-memory database and cannot target external or real account data.
export async function GET(request:NextRequest){
 if(!classBLabAvailable())return NextResponse.json({ok:false},{status:404});
 if(request.nextUrl.searchParams.get("smoke")!=="1")return NextResponse.json({ok:false},{status:400});
 try{
   const {runClassBLab}=await import("@/lib/testing/classBLab");
   const x=await runClassBLab(["pay","event","paid","unpaid","open","enterUnpaid","enterPaid","enterPaid","confirmCash","manualPresent","close","enterPaid"]);
   const passed=x.plan==="b"&&x.blocks===1&&x.entries.length===2&&x.paid===2&&x.unpaid===0&&x.attended===2&&!x.gate&&
     x.results.every((r,i)=>r.ok===![5,11].includes(i));
   return NextResponse.json({ok:passed,isolated:true,checks:{purchase:x.plan==="b",registered:x.entries.length,paid:x.paid,attended:x.attended,gateClosed:!x.gate,expectedRejections:x.results.filter(r=>!r.ok).length}},{status:passed?200:500,headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("[CLASS B LAB SMOKE]",error);return NextResponse.json({ok:false,message:"隔離環境の実行エラー"},{status:500});}
}
