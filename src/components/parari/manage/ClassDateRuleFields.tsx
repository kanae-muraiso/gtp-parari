import { classWeekdays, type ClassDateRule } from "@/lib/classRecurrence";

const field = "block w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-2 py-2";

export function ClassDateRuleFields({ rule, change }: { rule: ClassDateRule; change: (rule: ClassDateRule) => void }) {
  const weekday = "weekday" in rule ? rule.weekday : 5;
  return <>
    <label>頻度 <select className={field} value={rule.kind} onChange={e => {
      const kind = e.target.value;
      if (kind === "date") change({ kind, date: 1 });
      else if (kind === "nth") change({ kind, weekday, ordinal: 1 });
      else change({ kind: "weekly", weekday });
    }}><option value="weekly">毎週</option><option value="nth">毎月・第何曜日</option><option value="date">毎月・日付指定</option></select></label>
    {rule.kind === "nth" && <label>第 <select className={field} value={rule.ordinal}
      onChange={e => change({ ...rule, ordinal: Number(e.target.value) })}>
      {[1, 2, 3, 4, 5].map(value => <option key={value}>{value}</option>)}
    </select></label>}
    {rule.kind === "date" ? <label>日付 <select className={field} value={rule.date}
      onChange={e => change({ ...rule, date: Number(e.target.value) })}>
      {Array.from({ length: 31 }, (_, index) => <option key={index} value={index + 1}>{index + 1}日</option>)}
    </select></label> : <label>曜日 <select className={field} value={rule.weekday}
      onChange={e => change({ ...rule, weekday: Number(e.target.value) })}>
      {classWeekdays.map((label, value) => <option key={label} value={value}>{label}曜日</option>)}
    </select></label>}
  </>;
}
