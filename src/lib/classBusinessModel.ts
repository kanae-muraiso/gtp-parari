// Owner's design preference. Not an authorization or membership entitlement.
export const serviceKinds=["course","workshop","event"] as const;
export type ServiceKind=typeof serviceKinds[number];
export type ClassBusinessModel={kinds:ServiceKind[];primary:ServiceKind;membership:boolean};
export const legacyBusinessModel:ClassBusinessModel={kinds:[...serviceKinds],primary:"course",membership:true};
export function parseBusinessModel(value:unknown):ClassBusinessModel|null{
 if(typeof value!=="string")return null;
 try{
  const v=JSON.parse(value);
  if(!v||!Array.isArray(v.kinds)||!v.kinds.length||v.kinds.some((k:unknown)=>!serviceKinds.includes(k as ServiceKind))||new Set(v.kinds).size!==v.kinds.length||!v.kinds.includes(v.primary)||typeof v.membership!=="boolean")return null;
  return {kinds:v.kinds,primary:v.primary,membership:v.membership};
 }catch{return null;}
}
export function orderedServiceKinds(model:ClassBusinessModel):ServiceKind[]{
 return [model.primary,...model.kinds.filter(k=>k!==model.primary)];
}
// Existing records remain reachable even when a new design preference excludes
// their type. Changing a model is never a close/delete or publication action.
export function visibleServiceKinds(model:ClassBusinessModel,existing:ServiceKind[]):ServiceKind[]{
 return [...new Set([...orderedServiceKinds(model),...existing])];
}
