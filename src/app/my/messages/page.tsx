// src/app/my/messages/page.tsx
// 2026-08-27 JST

"use client";

import * as React from "react";

import {
  supabase,
} from "@/lib/supabaseClient";

import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";
import MessageThreadPanel from "@/components/parari/messages/MessageThreadPanel";


type MessageThreadSummary = {
  id: string;

  counterpart: {
    user_id: string;

    username:
      | string
      | null;

    display_name:
      | string
      | null;
  };

  relationship_label:
    string;

  last_message_body:
    | string
    | null;

  last_message_at:
    | string
    | null;

  is_last_message_mine:
    boolean;
};


function formatMessageListDate(
  value:
    | string
    | null,
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "ja-JP",
    {
      month:
        "numeric",

      day:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    },
  ).format(date);
}


export default function MyMessagesPage() {
  const [
    threads,
    setThreads,
  ] =
    React.useState<
      MessageThreadSummary[]
    >([]);

  const [
    selectedThreadId,
    setSelectedThreadId,
  ] =
    React.useState<
      string | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    React.useState(true);

  const [
    message,
    setMessage,
  ] =
    React.useState("");


  const loadThreads =
    React.useCallback(
      async () => {
        setLoading(true);
        setMessage("");

        try {
          if (!supabase) {
            setMessage(
              "ログイン情報を確認できませんでした。",
            );
            return;
          }

          const {
            data: { session },
          } =
            await supabase.auth.getSession();

          if (
            !session?.access_token
          ) {
            setMessage(
              "メッセージを見るにはログインしてください。",
            );
            return;
          }

          const response =
            await fetch(
              "/api/messages",
              {
                headers: {
                  Authorization:
                    `Bearer ${session.access_token}`,
                },

                cache:
                  "no-store",
              },
            );

          const result =
            (await response
              .json()
              .catch(
                () => null,
              )) as
              | {
                  ok?: boolean;

                  threads?:
                    MessageThreadSummary[];

                  message?: string;
                }
              | null;

          if (
            !response.ok ||
            !result?.ok
          ) {
            setMessage(
              result?.message ??
                "メッセージ一覧を取得できませんでした。",
            );

            return;
          }

          setThreads(
            result.threads ??
              [],
          );
        } catch (error) {
          console.error(
            "[MY messages] load failed:",
            error,
          );

          setMessage(
            "メッセージ一覧を取得できませんでした。",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );


  React.useEffect(() => {
    void loadThreads();
  }, [
    loadThreads,
  ]);


  const selectedThread =
    selectedThreadId
      ? threads.find(
          (thread) =>
            thread.id ===
            selectedThreadId,
        ) ?? null
      : null;


  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <MyAreaHeader title="メッセージ" />

        <div className="mt-6">
          <MyPrimaryTabs active="messages" />
        </div>

        <div className="mx-auto mt-8 max-w-2xl">
          {selectedThread ? (
            <div>
              <button
                type="button"
                onClick={() => {
                  setSelectedThreadId(
                    null,
                  );

                  void loadThreads();
                }}
                className="text-sm font-bold text-neutral-600 transition hover:text-neutral-950"
              >
                ← メッセージ一覧へ戻る
              </button>

              <MessageThreadPanel
                threadId={
                  selectedThread.id
                }
                fallbackCounterpartLabel={
                  selectedThread
                    .counterpart
                    .display_name ||
                  selectedThread
                    .counterpart
                    .username ||
                  "連絡相手"
                }
              />
            </div>
          ) : (
            <>
              <div className="mb-5">
                <div className="text-sm font-bold text-neutral-950">
                  メッセージ
                </div>

                <p className="mt-1 text-xs leading-6 text-neutral-500">
                  PARARIで関係が成立した相手との連絡です。
                </p>
              </div>

              {loading ? (
                <div className="rounded-3xl border border-neutral-200 bg-white p-6">
                  <p className="text-sm text-neutral-500">
                    メッセージを読み込んでいます...
                  </p>
                </div>
              ) : message ? (
                <div className="rounded-3xl border border-neutral-200 bg-white p-6">
                  <p className="text-sm leading-7 text-neutral-600">
                    {message}
                  </p>
                </div>
              ) : threads.length ===
                0 ? (
                <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center">
                  <div className="text-lg font-bold text-neutral-950">
                    まだメッセージはありません
                  </div>

                  <p className="mt-2 text-sm leading-7 text-neutral-500">
                    APPLICATIONなどで関係が成立した相手とのメッセージがここに表示されます。
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
                  {threads.map(
                    (
                      thread,
                      index,
                    ) => {
                      const name =
                        thread
                          .counterpart
                          .display_name ||
                        thread
                          .counterpart
                          .username ||
                        "PARARIユーザー";

                      return (
                        <button
                          key={
                            thread.id
                          }
                          type="button"
                          onClick={() => {
                            setSelectedThreadId(
                              thread.id,
                            );
                          }}
                          className={
                            index ===
                            0
                              ? "block w-full px-6 py-5 text-left transition hover:bg-neutral-50"
                              : "block w-full border-t border-neutral-100 px-6 py-5 text-left transition hover:bg-neutral-50"
                          }
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="font-bold text-neutral-950">
                                {name}
                              </div>

                              <div className="mt-1 text-xs font-bold text-neutral-400">
                                {
                                  thread.relationship_label
                                }
                              </div>

                              <div className="mt-2 truncate text-sm text-neutral-600">
                                {thread.is_last_message_mine
                                  ? "あなた："
                                  : ""}
                                {thread.last_message_body ||
                                  "メッセージ"}
                              </div>
                            </div>

                            <div className="shrink-0 text-xs text-neutral-400">
                              {formatMessageListDate(
                                thread.last_message_at,
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
