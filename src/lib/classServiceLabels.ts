// Presentation only. These stable keys never determine service type, billing or quotas.
export const defaultServiceLabels={course:"コース",class:"クラス",workshop:"短期講習会",event:"イベント"};
export type ServiceLabels=typeof defaultServiceLabels;
export const serviceLabelKeys=Object.keys(defaultServiceLabels) as (keyof ServiceLabels)[];
export function readServiceLabels(value:unknown):ServiceLabels{
 const raw=value&&typeof value==="object"?value as Record<string,unknown>:{};
 return Object.fromEntries(serviceLabelKeys.map(key=>{
  const v=raw["service_"+key];
  return [key,typeof v==="string"&&v.trim().length>0&&v.trim().length<=24?v.trim():defaultServiceLabels[key]];
 })) as ServiceLabels;
}
export function serviceLabelPatch(value:unknown):Record<string,string>|null{
 if(!value||typeof value!=="object")return null;
 const raw=value as Record<string,unknown>;
 const entries=serviceLabelKeys.map(key=>[key,typeof raw[key]==="string"?raw[key].trim():""] as const);
 if(entries.some(([,v])=>!v||v.length>24||/[\u0000-\u001f\u007f]/.test(v)))return null;
 return Object.fromEntries(entries.map(([key,v])=>["service_"+key,v]));
}
