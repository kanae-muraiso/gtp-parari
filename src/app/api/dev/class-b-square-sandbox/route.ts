import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {getSquareEnvironment,SQUARE_API_VERSION} from "@/lib/square/config";
import {getSquareMainLocation,createSquarePaymentLink} from "@/lib/square/api";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
function token(){
 // This route cannot use a seller connection, production token or DB.
 if(process.env.VERCEL_ENV!=="preview"||getSquareEnvironment()!=="sandbox")return null;
 return process.env.SQUARE_SANDBOX_TEST_ACCESS_TOKEN?.trim()||null;
}
export async function GET(){
 const accessToken=token();
 if(!accessToken)return reply({ok:false,message:"Square Sandbox専用の認証情報がありません。"},404);
 try{
  const response=await fetch("https://connect.squareupsandbox.com/v2/locations",{headers:{Authorization:"Bearer "+accessToken,"Square-Version":SQUARE_API_VERSION},cache:"no-store",signal:AbortSignal.timeout(5000)});
  if(!response.ok)return reply({ok:false,environment:"sandbox",providerStatus:response.status,message:response.status===401||response.status===403?"Sandbox認証情報を更新してください。":"Square Sandbox APIがリクエストを拒否しました。"},502);
  const data=await response.json();
  const locations=Array.isArray(data.locations)?data.locations:[];
  const location=locations.find((l:{status?:string})=>l.status==="ACTIVE");
  return reply({ok:Boolean(location),environment:"sandbox",connected:true,currency:location?.currency??null,locationActive:Boolean(location),locationCount:locations.length},location?200:409);
 }catch{return reply({ok:false,environment:"sandbox",message:"Square Sandboxへの通信が失敗しました。"},502);}
}
export async function POST(request:NextRequest){
 const accessToken=token();
 if(!accessToken)return reply({ok:false},404);
 // Prevent accidental cross-origin requests. Fixed test item; replay
 // the same idempotency key for the same deployment instead of creating
 // a new checkout for every click.
 if(request.headers.get("origin")!==request.nextUrl.origin)return reply({ok:false,message:"同じテスト画面から実行してください。"},403);
 try{
  const location=await getSquareMainLocation(accessToken);
  if(location.status!=="ACTIVE"||!location.currency)return reply({ok:false,message:"テスト用店舗が利用できません。"},409);
  const key=createHash("sha256").update("class-b-square-sandbox:"+request.nextUrl.origin).digest("hex").slice(0,36);
  const result=await createSquarePaymentLink({accessToken,locationId:location.id,idempotencyKey:key,name:"PARARI CLASS B SANDBOX TEST",amountMinor:1000,currency:location.currency,
    redirectUrl:new URL("/dev/class-b-lab?squareSandbox=return",request.nextUrl.origin).href,paymentNote:"PARARI sandbox only"});
  return reply({ok:true,environment:"sandbox",currency:location.currency,amountMinor:1000,url:result.url});
 }catch{return reply({ok:false,environment:"sandbox",message:"Square Sandboxのテスト決済リンクを作成できませんでした。"},502);}
}
