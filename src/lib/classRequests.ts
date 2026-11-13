import { supabase } from "@/lib/supabaseClient";

export class ClassRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function classRequest<T>(path = "", body?: object, signal?: AbortSignal): Promise<T> {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new ClassRequestError("ログインが必要です。", 401);
  const response = await fetch(`/api/classes${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal,
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new ClassRequestError(data.message || "処理できませんでした。", response.status);
  return data;
}
