// src/lib/cpp/ai/contracts.ts
// 2026-10-09 JST — PART: CPP AI shared limits and messages
export const CPP_AI_LIMITS = {
  userChars: 2000,
  assistantChars: 6000,
  totalChars: 24000,
  messages: 39,
  bodyBytes: 100000,
} as const;

export type CppAiMessage = { role: "user" | "assistant"; content: string };
export type CppAiRequest = {
  messages: CppAiMessage[];
  useProfile: boolean;
  consent: true;
};
export type CppAiStatus = {
  available: boolean;
  message?: string;
  code?: string;
};

export const CPP_AI_PREPARING = "CPP AIは準備中です。プロフィールの編集やCPPのほかの機能は引き続き利用できます。";

// Do not accept user IDs, arbitrary context, system roles, tools or model options.
export function parseCppAiRequest(value: unknown): CppAiRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["messages", "useProfile", "consent"].includes(key))) return null;
  if (body.consent !== true || typeof body.useProfile !== "boolean" || !Array.isArray(body.messages)) return null;
  if (!body.messages.length || body.messages.length > CPP_AI_LIMITS.messages || body.messages.length % 2 !== 1) return null;
  let total = 0;
  const messages: CppAiMessage[] = [];
  for (const [index, item] of body.messages.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    if (Object.keys(item).some((key) => !["role", "content"].includes(key))) return null;
    const role = index % 2 === 0 ? "user" : "assistant";
    if (item.role !== role || typeof item.content !== "string" || !item.content.trim()) return null;
    if (item.content.length > (role === "user" ? CPP_AI_LIMITS.userChars : CPP_AI_LIMITS.assistantChars)) return null;
    total += item.content.length;
    if (total > CPP_AI_LIMITS.totalChars) return null;
    messages.push({ role, content: item.content });
  }
  return { messages, useProfile: body.useProfile, consent: true };
}
