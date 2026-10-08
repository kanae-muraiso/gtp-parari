// src/lib/commerce/subscriptionPeriod.ts
// 2026-10-08 JST / PART: Exclusive expiry at midnight after the provider billing date
export function subscriptionPeriodEnd(date: string, timezone: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        throw new Error("Invalid billing date");
    const start = Date.parse(date + "T00:00:00Z");
    if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== date)
        throw new Error("Invalid billing date");
    const target = start + 86400000;
    const format = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    let instant = target;
    for (let i = 0; i < 4; i++) {
        const p = Object.fromEntries(format.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
        const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
        const difference = target - wall;
        if (!difference)
            return new Date(instant).toISOString();
        instant += difference;
    }
    throw new Error("Cannot resolve billing timezone");
}
