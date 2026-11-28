// The lab is deliberately unavailable on all production deployments.
export function classBLabAvailable(){
 return process.env.VERCEL_ENV==="preview"||(!process.env.VERCEL_ENV&&process.env.NODE_ENV==="development");
}
