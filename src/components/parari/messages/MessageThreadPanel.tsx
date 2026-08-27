"use client";

import * as React from "react";

import {
  supabase,
} from "@/lib/supabaseClient";


type ParariMessage = {
  id: string;
  body: string;
  created_at: string;
  is_mine: boolean;
};


type ConversationInfo = {
  thread_id:
    | string
    | null;

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
};


type MessageThreadPanelProps = {
  threadId?: string | null;

  contextType?:
    | "application"
    | "calendar"
    | "membership"
    | "collaboration";

  contextId?: string | null;

  fallbackCounterpartLabel?: string;

  onClose?: () => void;
};


function formatMessageDateTime(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
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


export default function MessageThreadPanel({
  threadId,
  contextType,
  contextId,
  fallbackCounterpartLabel =
    "連絡相手",
  onClose,
}: MessageThreadPanelProps) {
  const [
    conversation,
    setConversation,
  ] =
    React.useState<
      ConversationInfo | null
    >(null);

  const [
    messages,
    setMessages,
  ] =
    React.useState<
      ParariMessage[]
    >([]);

  const [
    draft,
    setDraft,
  ] =
    React.useState("");

  const [
    loading,
    setLoading,
  ] =
    React.useState(true);

  const [
    sending,
    setSending,
  ] =
    React.useState(false);

  const [
    statusMessage,
    setStatusMessage,
  ] =
    React.useState("");


  const loadMessages =
    React.useCallback(
      async () => {
        setLoading(true);
        setStatusMessage("");

        try {
          if (!supabase) {
            setStatusMessage(
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
            setStatusMessage(
              "ログイン情報を確認できませんでした。",
            );
            return;
          }

          const params =
            new URLSearchParams();

          if (threadId) {
            params.set(
              "threadId",
              threadId,
            );
          } else if (
            contextType &&
            contextId
          ) {
            params.set(
              "contextType",
              contextType,
            );

            params.set(
              "contextId",
              contextId,
            );
          } else {
            setStatusMessage(
              "メッセージを開けませんでした。",
            );
            return;
          }

          const response =
            await fetch(
              `/api/messages?${params.toString()}`,
              {
                method:
                  "GET",

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

                  conversation?:
                    ConversationInfo;

                  messages?:
                    ParariMessage[];

                  message?: string;
                }
              | null;

          if (
            !response.ok ||
            !result?.ok
          ) {
            setConversation(
              null,
            );

            setMessages([]);

            setStatusMessage(
              result?.message ??
                "メッセージを取得できませんでした。",
            );

            return;
          }

          setConversation(
            result.conversation ??
              null,
          );

          setMessages(
            result.messages ??
              [],
          );
        } catch (error) {
          console.error(
            "[MESSAGE panel] load failed:",
            error,
          );

          setStatusMessage(
            "メッセージを取得できませんでした。",
          );
        } finally {
          setLoading(false);
        }
      },
      [
        threadId,
        contextType,
        contextId,
      ],
    );


  React.useEffect(() => {
    void loadMessages();
  }, [
    loadMessages,
  ]);


  async function sendMessage() {
    const normalizedDraft =
      draft.trim();

    if (
      !normalizedDraft ||
      sending
    ) {
      return;
    }

    setSending(true);
    setStatusMessage("");

    try {
      if (!supabase) {
        setStatusMessage(
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
        setStatusMessage(
          "ログイン情報を確認できませんでした。",
        );
        return;
      }

      const payload:
        Record<
          string,
          string
        > = {
          message:
            normalizedDraft,
        };

      if (threadId) {
        payload.threadId =
          threadId;
      } else if (
        contextType &&
        contextId
      ) {
        payload.contextType =
          contextType;

        payload.contextId =
          contextId;
      } else {
        setStatusMessage(
          "メッセージを送信できませんでした。",
        );
        return;
      }

      const response =
        await fetch(
          "/api/messages",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body:
              JSON.stringify(
                payload,
              ),
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

              conversation?: {
                thread_id:
                  string;
              };

              createdMessage?:
                ParariMessage;

              message?: string;
            }
          | null;

      if (
        !response.ok ||
        !result?.ok ||
        !result.createdMessage
      ) {
        setStatusMessage(
          result?.message ??
            "メッセージを送信できませんでした。",
        );

        return;
      }

      setMessages(
        (current) => [
          ...current,
          result.createdMessage as
            ParariMessage,
        ],
      );

      if (
        conversation &&
        !conversation.thread_id &&
        result.conversation
          ?.thread_id
      ) {
        setConversation({
          ...conversation,

          thread_id:
            result.conversation
              .thread_id,
        });
      }

      setDraft("");
    } catch (error) {
      console.error(
        "[MESSAGE panel] send failed:",
        error,
      );

      setStatusMessage(
        "メッセージを送信できませんでした。",
      );
    } finally {
      setSending(false);
    }
  }


  const counterpartName =
    conversation
      ?.counterpart
      .display_name ||
    conversation
      ?.counterpart
      .username ||
    fallbackCounterpartLabel;


  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-neutral-950">
            {counterpartName}
          </div>

          <p className="mt-1 text-xs text-neutral-500">
            {conversation
              ?.relationship_label ||
              "メッセージ"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void loadMessages();
            }}
            disabled={loading}
            className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-200 disabled:opacity-40"
          >
            更新
          </button>

          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-200"
            >
              閉じる
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-xl bg-neutral-50 p-3">
        {loading ? (
          <p className="text-sm text-neutral-500">
            メッセージを読み込んでいます...
          </p>
        ) : messages.length ===
          0 ? (
          <p className="text-sm text-neutral-500">
            まだメッセージはありません。
          </p>
        ) : (
          messages.map(
            (message) => (
              <div
                key={message.id}
                className={
                  message.is_mine
                    ? "ml-auto max-w-[85%] rounded-2xl bg-neutral-900 px-4 py-3 text-white"
                    : "mr-auto max-w-[85%] rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900"
                }
              >
                <div className="whitespace-pre-wrap text-sm leading-6">
                  {message.body}
                </div>

                <div
                  className={
                    message.is_mine
                      ? "mt-1 text-[10px] text-neutral-300"
                      : "mt-1 text-[10px] text-neutral-400"
                  }
                >
                  {formatMessageDateTime(
                    message.created_at,
                  )}
                </div>
              </div>
            ),
          )
        )}
      </div>

      <div className="mt-4">
        <textarea
          value={draft}
          onChange={(event) => {
            setDraft(
              event.target.value,
            );
          }}
          maxLength={2000}
          rows={3}
          placeholder="メッセージを入力"
          className="w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-neutral-600"
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-neutral-400">
            {draft.length}
            /2000
          </div>

          <button
            type="button"
            disabled={
              sending ||
              !draft.trim()
            }
            onClick={() => {
              void sendMessage();
            }}
            className="rounded-full bg-neutral-950 px-5 py-2 text-xs font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending
              ? "送信中..."
              : "送信"}
          </button>
        </div>

        {statusMessage ? (
          <p className="mt-2 text-xs leading-6 text-red-600">
            {statusMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
