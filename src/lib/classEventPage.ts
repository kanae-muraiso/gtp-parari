import { classIdPattern } from "./classes";

/** An authored event PAGE is editorial content only; registration stays in CLASS. */
export function eventPageMetadata(content:string|null|undefined):{eventId:string}|null{
  if(typeof content!=="string" || !/^\s*\[PAGE\](?:\s|$)/i.test(content))return null;
  const meta=/^\[PAGEINFO\]\s*\r?\n((?:(?!\[[A-Z][A-Z0-9_]*\]).*\r?\n?){1,15})/im.exec(content.slice(0,1600));
  if(!meta||meta.index>400||!/^\[T\]/m.test(content))return null;
  const fields=Object.fromEntries(meta[1].split(/\r?\n/).map(line=>/^([a-z_]+):\s*(.+?)\s*$/.exec(line))
    .filter((match):match is RegExpExecArray=>Boolean(match)).map(match=>[match[1],match[2]]));
  return fields.role==="class_event"&&fields.schema_version==="1"&&classIdPattern.test(fields.event_id??"")
    ? {eventId:fields.event_id}:null;
}
export function eligibleClassEventPage(content:string|null|undefined,eventId:string){
  return eventPageMetadata(content)?.eventId===eventId;
}
export function starterClassEventPageSsot(title:string,eventId:string,description:string){
  if(!classIdPattern.test(eventId))throw new Error("Invalid event");
  const safe=(s:string,max:number)=>s.replace(/\r/g,"").replace(/^\s*\[/gm,"［").replace(/\u0000/g,"").slice(0,max);
  return [
    "[PAGE]","title: "+safe(title.replace(/\n/g," "),120),
    "[PAGEINFO]","role: class_event","schema_version: 1","event_id: "+eventId,
    "[T]",safe(description||"イベントのご案内です。写真や詳しい紹介を追加できます。",4000)
  ].join("\n");
}
