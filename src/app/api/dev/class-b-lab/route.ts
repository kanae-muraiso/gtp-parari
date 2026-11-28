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
