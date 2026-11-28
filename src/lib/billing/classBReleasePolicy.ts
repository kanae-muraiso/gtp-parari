/** Keep real billing closed unless the ledger and deployment target are
 * explicitly configured. Preview must use a separately identified test DB.
 * The pilot allowlist is server-only; a client cannot opt in. */
type Env=Record<string,string|undefined>;
export function classBBillingTargetReady(env:Env=process.env):boolean {
 if(env.CLASS_B_CONTRACT_LEDGER_READY!=="true")return false;
 if(env.VERCEL_ENV==="production")return true;
 if(env.VERCEL_ENV!=="preview"&&env.NODE_ENV!=="development")return false;
 const test=env.CLASS_B_TEST_DB_PROJECT_REF?.trim();
 const production=env.CLASS_B_PRODUCTION_DB_PROJECT_REF?.trim();
 if(!test||!production||test===production||!env.NEXT_PUBLIC_SUPABASE_URL)return false;
 try{return new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname===test+".supabase.co";}catch{return false;}
}
export function classBPurchaseAllowed(ownerId:string,env:Env=process.env):boolean{
 if(!classBBillingTargetReady(env)||env.CLASS_B_CHECKOUT_ENABLED!=="true"||
   !env.STRIPE_CLASS_B_JPY_PRICE_ID?.trim()||!env.STRIPE_CLASS_B_PORTAL_CONFIGURATION_ID?.trim())return false;
 if(env.CLASS_B_PUBLIC_CHECKOUT_ENABLED==="true")return true;
 return env.CLASS_B_PILOT_OWNER_IDS?.split(",").map(id=>id.trim()).includes(ownerId)===true;
}
