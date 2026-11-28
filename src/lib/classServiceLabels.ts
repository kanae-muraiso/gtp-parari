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

export const defaultRoleLabels={operator:"先生",learner:"生徒",proxy:"保護者",admission:"入会"};
export type RoleLabels=typeof defaultRoleLabels;
export const roleLabelKeys=Object.keys(defaultRoleLabels) as (keyof RoleLabels)[];
export function readRoleLabels(value:unknown):RoleLabels{
 const raw=value&&typeof value==="object"?value as Record<string,unknown>:{};
 return Object.fromEntries(roleLabelKeys.map(k=>[k,typeof raw[k]==="string"&&raw[k].trim()&&raw[k].trim().length<=24?raw[k].trim():defaultRoleLabels[k]])) as RoleLabels;
}
export function allLabelPatch(service:unknown,roles:unknown):Record<string,string>|null{
 const servicePatch=serviceLabelPatch(service);
 if(!servicePatch||!roles||typeof roles!=="object")return null;
 const raw=roles as Record<string,unknown>;
 const entries=roleLabelKeys.map(k=>[k,typeof raw[k]==="string"?raw[k].trim():""] as const);
 if(entries.some(([,v])=>!v||v.length>24||/[\u0000-\u001f\u007f]/.test(v)))return null;
 return {...servicePatch,...Object.fromEntries(entries)};
}
