import type { ClassBusinessFrontContent, ClassBusinessFrontLink } from "./classBusinessFront";

export const classSetupSteps = [
  { title: "事業の紹介", description: "教室・事業の名前、紹介文、共通の呼び方を決めます。" },
  { title: "クラスの内容・料金", description: "何を教えるか、どう通ってもらうか、料金と定員を決めます。" },
  { title: "開催日", description: "クラスごとに曜日・時間・会場を登録し、開催予定と休講を確認します。" },
  { title: "入会方法", description: "直接申し込むか、説明会・体験から始めるかを決め、申込画面とメールを用意します。" },
  { title: "お客様として確認", description: "保存した内容で、紹介と日程から申込受付までの見え方を確かめます。" },
  { title: "募集を始める", description: "入会受付と紹介ページの公開状態を確認し、案内するURLを取得します。" },
] as const;

// A public introduction must lead to an available intake and a scheduled class.
export function classFrontPublishIssues(content: ClassBusinessFrontContent, links: ClassBusinessFrontLink[]) {
  const selected = links.filter(link => content.entries.includes(link.key));
  const issues: string[] = [];
  if (!content.introduction.trim()) issues.push("事業の紹介文を保存してください。");
  const courses = selected.filter(link => link.course);
  if (!courses.length) issues.push("掲載するクラスを選んでください。");
  for (const link of courses) {
    if (!link.course!.slots.some(slot => slot.upcoming?.length)) issues.push(link.title + "の今月・来月の開催予定を用意してください。");
  }
  if (!selected.some(link => link.key.startsWith("intake:"))) issues.push("入会受付を公開し、掲載項目の入会申込・説明会予約を選んでください。");
  if (content.entries.some(key => !links.some(link => link.key === key))) issues.push("掲載停止中の項目を確認してください。");
  return issues;
}
