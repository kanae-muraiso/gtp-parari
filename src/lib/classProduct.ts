import type { SchoolClass } from "./classes";

export type ClassSlotDefaults = {
  duration: number;
  delivery: SchoolClass["delivery"];
  location: string;
};

export const defaultClassSlotSettings: ClassSlotDefaults = { duration: 60, delivery: "onsite", location: "" };

export type ClassAudience = "adult" | "minor";

export type ClassProduct = {
  audience?: ClassAudience;
  classIds: string[];
  walkInFee?: number | null;
  slotDefaults?: ClassSlotDefaults;
  description: string;
  capacity: number;
  monthlyFee: number;
  monthlyVisits: number;
  booking: "fixed" | "multiple" | "flexible";
  extraFee: number | null;
  makeup: "none" | "approval" | "notice";
  makeupExpiry: "same_month" | "next_month";
};

export type NamedClassProduct = { id: string; name: string; design: ClassProduct };

export function parseClassProduct(value: unknown, allowed: Set<string>, allowEmpty = false): ClassProduct | null {
  if (!value || typeof value !== "object") return null;
  const p = value as ClassProduct;
  const integer = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;
  if ((p.audience !== undefined && p.audience !== "adult" && p.audience !== "minor") || !Array.isArray(p.classIds) || (!allowEmpty && !p.classIds.length) || p.classIds.some(id => !allowed.has(id)) ||
      typeof p.description !== "string" || p.description.length > 1000 ||
      (p.walkInFee != null && !integer(p.walkInFee, 0, 1000000)) ||
      !integer(p.capacity, 1, 1000) || !integer(p.monthlyFee, 0, 1000000) || !integer(p.monthlyVisits, 1, 100) ||
      !["fixed", "multiple", "flexible"].includes(p.booking) ||
      (p.extraFee !== null && !integer(p.extraFee, 1, 1000000)) ||
      !["none", "approval", "notice"].includes(p.makeup) ||
      !["same_month", "next_month"].includes(p.makeupExpiry)) return null;
  const slotDefaults = p.slotDefaults;
  if (slotDefaults !== undefined && (!slotDefaults || typeof slotDefaults !== "object" ||
    !integer(slotDefaults.duration, 5, 480) || !["onsite", "online", "hybrid"].includes(slotDefaults.delivery) ||
    typeof slotDefaults.location !== "string" || slotDefaults.location.length > 200 ||
    (slotDefaults.delivery === "hybrid" && !slotDefaults.location.trim()))) return null;
  return { ...(p.audience ? { audience: p.audience } : {}), classIds: [...new Set(p.classIds)], description: p.description.trim(), capacity: p.capacity,
    monthlyFee: p.monthlyFee, monthlyVisits: p.monthlyVisits, booking: p.booking, extraFee: p.extraFee,
    makeup: p.makeup, makeupExpiry: p.makeupExpiry, walkInFee: p.walkInFee ?? null,
    ...(slotDefaults ? { slotDefaults: { duration: slotDefaults.duration, delivery: slotDefaults.delivery,
      location: slotDefaults.delivery === "online" ? "" : slotDefaults.location.trim() } } : {}) };
}

export function describeClassProduct(p: ClassProduct, names: string[]) {
  const yen = (n: number) => n.toLocaleString("ja-JP") + "円";
  if (p.walkInFee != null) return `予約不要・当日参加。基本参加費は1回${yen(p.walkInFee)}です。開催日ごとの会場と料金は日程表をご確認ください。`;
  const fee = p.monthlyFee ? "月謝" + yen(p.monthlyFee) + "で、" : "無料で、";
  const expiry = p.makeupExpiry === "same_month" ? "欠席した月の末日" : "欠席した月の翌月末";
  return [
    fee + names.join("・") + "に合計月" + p.monthlyVisits + "回通えます。定員は各回" + p.capacity + "人です。",
    p.booking === "fixed" ? "毎週、決まったクラスに通います。" : p.booking === "multiple" ? "指定された複数クラスに所属します。" : "空席のある回をその都度予約します。",
    p.makeup === "none" ? "欠席分の振替はありません。" :
      (p.makeup === "approval" ? "先生が承認した欠席分" : "事前連絡のあった欠席分") + "は、" + expiry + "まで対象クラスの空席で振り替えられます。",
    p.extraFee === null ? "追加受講はありません。" : "月謝分と振替分を使い切った場合、空席があれば1回" + yen(p.extraFee) + "で追加受講できます。",
  ].join("\n");
}
