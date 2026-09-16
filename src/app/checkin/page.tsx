// src/app/checkin/page.tsx
// 2026-09-17 JST
//
// Dedicated APPLICATION check-in mode.
// Ordinary participant QR URLs (/q/:passCode) are read-only.
// Check-in mutations are intentionally exposed only from this dedicated mode.

"use client";

import * as React from "react";

import { supabase } from "@/lib/supabaseClient";

type Occurrence = {
  id: string;
  calendar_item_id?: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  title: string | null;
  location: string | null;
  status?: string;
};

type PassData = {
  application_title: string;
  participant_name: string;
  status: string;
  checked_in_at: string | null;
  occurrence: Occurrence | null;
};

type CheckInResponse = {
  ok?: boolean;
  pass?: PassData;
  checked_in_at?: string | null;
  already_checked_in?: boolean;
  message?: string;
};

type CheckInStartResponse = {
  ok?: boolean;
  already_started?: boolean;
  check_in_started_at?: string | null;
  scope?: "application" | "occurrence";
  application_id?: string;
  occurrence_id?: string | null;
  message?: string;
};

type ManagedApplication = {
  id: string;
  origin?: "manual" | "calendar";
  calendar_item_id?: string | null;
  title: string;
};

type BarcodeResult = {
  rawValue?: string;
};

type BarcodeDetectorLike = {
  detect(source: HTMLVideoElement): Promise<BarcodeResult[]>;
};

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

type CameraState =
  | "idle"
  | "starting"
  | "scanning"
  | "unsupported"
  | "error";

const PASS_CODE_RE = /^[0-9a-f]{16}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readPassCode(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (PASS_CODE_RE.test(normalized)) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    const parts = url.pathname
      .split("/")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);

    const qIndex = parts.lastIndexOf("q");
    const candidate = qIndex >= 0 ? parts[qIndex + 1] ?? "" : "";

    return PASS_CODE_RE.test(candidate) ? candidate : "";
  } catch {
    return "";
  }
}

function formatOccurrenceDate(occurrence: Occurrence): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: occurrence.timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(occurrence.starts_at));
  } catch {
    return occurrence.starts_at;
  }
}

function formatStartedAt(value: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function CheckInModePage() {
  const [queryReady, setQueryReady] = React.useState(false);
  const [requestedApplicationId, setRequestedApplicationId] =
    React.useState("");
  const [requestedCalendarItemId, setRequestedCalendarItemId] =
    React.useState("");

  const [authState, setAuthState] = React.useState<
    "checking" | "signed_out" | "signed_in"
  >("checking");
  const [accessToken, setAccessToken] = React.useState("");

  const [application, setApplication] =
    React.useState<ManagedApplication | null>(null);
  const [contextLoading, setContextLoading] = React.useState(false);
  const [contextMessage, setContextMessage] = React.useState("");
  const [occurrences, setOccurrences] = React.useState<Occurrence[]>([]);
  const [selectedOccurrenceId, setSelectedOccurrenceId] = React.useState("");

  const [startingCheckIn, setStartingCheckIn] = React.useState(false);
  const [checkInStartedAt, setCheckInStartedAt] = React.useState("");
  const [checkInStartMessage, setCheckInStartMessage] = React.useState("");

  const [rawCode, setRawCode] = React.useState("");
  const [passCode, setPassCode] = React.useState("");
  const [pass, setPass] = React.useState<PassData | null>(null);
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [checkingIn, setCheckingIn] = React.useState(false);
  const [cameraState, setCameraState] = React.useState<CameraState>("idle");

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const scanTimerRef = React.useRef<number | null>(null);
  const scanActiveRef = React.useRef(false);

  const stopCamera = React.useCallback(() => {
    scanActiveRef.current = false;

    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraState((current) =>
      current === "unsupported" || current === "error" ? current : "idle",
    );
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    setRequestedApplicationId(
      params.get("applicationId")?.trim() ?? "",
    );
    setRequestedCalendarItemId(
      params.get("calendarItemId")?.trim() ?? "",
    );
    setQueryReady(true);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      if (!supabase) {
        if (!cancelled) {
          setAuthState("signed_out");
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      if (!session?.access_token) {
        setAuthState("signed_out");
        return;
      }

      setAccessToken(session.access_token);
      setAuthState("signed_in");
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    return () => {
      scanActiveRef.current = false;

      if (scanTimerRef.current !== null) {
        window.clearTimeout(scanTimerRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  React.useEffect(() => {
    if (!queryReady || authState !== "signed_in" || !accessToken) {
      return;
    }

    if (!UUID_RE.test(requestedApplicationId)) {
      setApplication(null);
      setOccurrences([]);
      setSelectedOccurrenceId("");
      setCheckInStartedAt("");
      setCheckInStartMessage("");
      setContextMessage(
        "運営 → APPLICATION の［QR受付］から受付する募集を選んでください。",
      );
      return;
    }

    let cancelled = false;

    async function loadContext() {
      setContextLoading(true);
      setContextMessage("");
      setApplication(null);
      setOccurrences([]);
      setSelectedOccurrenceId("");
      setCheckInStartedAt("");
      setCheckInStartMessage("");
      setPass(null);
      setPassCode("");
      setRawCode("");
      stopCamera();

      try {
        const applicationResponse = await fetch("/api/application/manage", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        });

        const applicationResult =
          (await applicationResponse.json().catch(() => null)) as
            | {
                ok?: boolean;
                applications?: ManagedApplication[];
                message?: string;
              }
            | null;

        if (
          !applicationResponse.ok ||
          !applicationResult?.ok ||
          !Array.isArray(applicationResult.applications)
        ) {
          if (!cancelled) {
            setContextMessage(
              applicationResult?.message ??
                "APPLICATIONを確認できませんでした。",
            );
          }
          return;
        }

        const selectedApplication =
          applicationResult.applications.find(
            (item) => item.id === requestedApplicationId,
          ) ?? null;

        if (!selectedApplication) {
          if (!cancelled) {
            setContextMessage(
              "このAPPLICATIONの受付権限を確認できませんでした。",
            );
          }
          return;
        }

        if (cancelled) {
          return;
        }

        setApplication(selectedApplication);

        const isCalendar = selectedApplication.origin === "calendar";
        const calendarItemId =
          selectedApplication.calendar_item_id?.trim() ||
          requestedCalendarItemId;

        if (!isCalendar) {
          return;
        }

        if (!UUID_RE.test(calendarItemId)) {
          setContextMessage(
            "このAPPLICATIONの開催回を確認できませんでした。",
          );
          return;
        }

        const occurrenceResponse = await fetch(
          `/api/calendar/occurrences?calendarItemId=${encodeURIComponent(
            calendarItemId,
          )}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
          },
        );

        const occurrenceResult =
          (await occurrenceResponse.json().catch(() => null)) as
            | {
                ok?: boolean;
                occurrences?: Occurrence[];
                message?: string;
              }
            | null;

        if (
          !occurrenceResponse.ok ||
          !occurrenceResult?.ok ||
          !Array.isArray(occurrenceResult.occurrences)
        ) {
          setContextMessage(
            occurrenceResult?.message ??
              "開催回を確認できませんでした。",
          );
          return;
        }

        if (cancelled) {
          return;
        }

        setOccurrences(
          occurrenceResult.occurrences.filter(
            (occurrence) => occurrence.status !== "cancelled",
          ),
        );
      } catch (error) {
        console.error("[CHECK-IN MODE] context load failed:", error);
        if (!cancelled) {
          setContextMessage(
            "受付するAPPLICATIONを確認できませんでした。",
          );
        }
      } finally {
        if (!cancelled) {
          setContextLoading(false);
        }
      }
    }

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    authState,
    queryReady,
    requestedApplicationId,
    requestedCalendarItemId,
    stopCamera,
  ]);

  const isCalendarApplication = application?.origin === "calendar";
  const contextReady =
    Boolean(application) &&
    (!isCalendarApplication || Boolean(selectedOccurrenceId));
  const checkInActive = contextReady && Boolean(checkInStartedAt);

  const returnTo = React.useMemo(() => {
    if (!requestedApplicationId) {
      return "/checkin";
    }

    const params = new URLSearchParams({
      applicationId: requestedApplicationId,
    });

    if (requestedCalendarItemId) {
      params.set("calendarItemId", requestedCalendarItemId);
    }

    return `/checkin?${params.toString()}`;
  }, [requestedApplicationId, requestedCalendarItemId]);

  async function startCheckInMode() {
    if (
      !accessToken ||
      !application ||
      !contextReady ||
      startingCheckIn ||
      checkInStartedAt
    ) {
      return;
    }

    const confirmed = window.confirm(
      "入場受付を開始します。\n\n開始すると、新規申込と参加者本人によるキャンセルを締め切ります。この操作は元に戻せません。",
    );

    if (!confirmed) {
      return;
    }

    setStartingCheckIn(true);
    setMessage("");
    setCheckInStartMessage("");
    stopCamera();

    try {
      const response = await fetch("/api/application/check-in/start", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicationId: application.id,
          occurrenceId:
            application.origin === "calendar"
              ? selectedOccurrenceId
              : undefined,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | CheckInStartResponse
        | null;

      if (
        !response.ok ||
        !result?.ok ||
        !result.check_in_started_at
      ) {
        setMessage(
          result?.message ?? "入場受付を開始できませんでした。",
        );
        return;
      }

      setCheckInStartedAt(result.check_in_started_at);
      setCheckInStartMessage(
        result.already_started
          ? "この入場受付はすでに開始されています。申込・本人キャンセルは締め切られています。"
          : "入場受付を開始しました。申込・本人キャンセルを締め切りました。",
      );
    } catch (error) {
      console.error("[CHECK-IN MODE] start failed:", error);
      setMessage("入場受付を開始できませんでした。");
    } finally {
      setStartingCheckIn(false);
    }
  }

  async function inspectPass(value: string = rawCode) {
    if (!accessToken || loading || !checkInActive) {
      return;
    }

    const code = readPassCode(value);

    if (!code) {
      setPassCode("");
      setPass(null);
      setMessage("参加証のQR URLまたは16桁の参加証コードを確認してください。");
      return;
    }

    setLoading(true);
    setMessage("");
    setPass(null);
    setPassCode(code);

    try {
      const response = await fetch(
        `/api/application/check-in?passCode=${encodeURIComponent(code)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        },
      );

      const result = (await response.json().catch(() => null)) as
        | CheckInResponse
        | null;

      if (!response.ok || !result?.ok || !result.pass) {
        setMessage(result?.message ?? "参加証を確認できませんでした。");
        return;
      }

      if (
        selectedOccurrenceId &&
        result.pass.occurrence?.id !== selectedOccurrenceId
      ) {
        setMessage("選択した開催回とは別の参加証です。");
        setPassCode("");
        return;
      }

      if (
        application &&
        result.pass.application_title !== application.title
      ) {
        setMessage("選択したAPPLICATIONとは別の参加証です。");
        setPassCode("");
        return;
      }

      setPass(result.pass);
    } catch (error) {
      console.error("[CHECK-IN MODE] inspect failed:", error);
      setMessage("参加証を確認できませんでした。");
    } finally {
      setLoading(false);
    }
  }

  async function startCamera() {
    if (!checkInActive) {
      return;
    }

    if (cameraState === "starting" || cameraState === "scanning") {
      return;
    }

    setMessage("");

    const Detector = (
      window as typeof window & {
        BarcodeDetector?: BarcodeDetectorConstructor;
      }
    ).BarcodeDetector;

    if (!navigator.mediaDevices?.getUserMedia || !Detector) {
      setCameraState("unsupported");
      setMessage(
        "このブラウザーではカメラからのQR自動読取を利用できません。下の入力欄へQR URLまたは参加証コードを入力してください。",
      );
      return;
    }

    setCameraState("starting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      const video = videoRef.current;

      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        setCameraState("error");
        setMessage("カメラ画面を開始できませんでした。");
        return;
      }

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();

      const detector = new Detector({ formats: ["qr_code"] });
      scanActiveRef.current = true;
      setCameraState("scanning");

      const scanFrame = async () => {
        if (!scanActiveRef.current || !videoRef.current) {
          return;
        }

        try {
          const results = await detector.detect(videoRef.current);
          const rawValue = results.find((result) => result.rawValue)?.rawValue ?? "";
          const code = readPassCode(rawValue);

          if (code) {
            setRawCode(rawValue);
            stopCamera();
            await inspectPass(rawValue);
            return;
          }
        } catch (error) {
          console.error("[CHECK-IN MODE] QR scan frame failed:", error);
        }

        if (scanActiveRef.current) {
          scanTimerRef.current = window.setTimeout(() => {
            void scanFrame();
          }, 250);
        }
      };

      void scanFrame();
    } catch (error) {
      console.error("[CHECK-IN MODE] camera start failed:", error);
      stopCamera();
      setCameraState("error");
      setMessage(
        "カメラを開始できませんでした。ブラウザーのカメラ権限を確認するか、下の入力欄を利用してください。",
      );
    }
  }

  async function checkIn() {
    if (!accessToken || !pass || !passCode || checkingIn || !checkInActive) {
      return;
    }

    if (!window.confirm(`${pass.participant_name}さんを受付しますか？`)) {
      return;
    }

    setCheckingIn(true);
    setMessage("");

    try {
      const response = await fetch("/api/application/check-in", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passCode }),
      });

      const result = (await response.json().catch(() => null)) as
        | CheckInResponse
        | null;

      if (!response.ok || !result?.ok) {
        setMessage(result?.message ?? "受付を完了できませんでした。");
        return;
      }

      setPass((current) =>
        current
          ? {
              ...current,
              checked_in_at: result.checked_in_at ?? current.checked_in_at,
            }
          : current,
      );
    } catch (error) {
      console.error("[CHECK-IN MODE] check-in failed:", error);
      setMessage("受付を完了できませんでした。");
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-neutral-950 px-5 py-8 text-white sm:py-10">
      <div className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl">
        <div className="text-xs font-bold tracking-[0.2em] text-white/60">
          PARARI CHECK-IN MODE
        </div>
        <h1 className="mt-2 text-2xl font-bold">QR受付</h1>
        <p className="mt-3 text-sm leading-7 text-white/70">
          APPLICATIONから受付する募集を選び、入場受付を開始してから参加者のQRを読み取ります。
        </p>

        <a
          href="/my/manage?tab=application"
          className="mt-4 inline-flex text-xs font-bold text-white/70 underline underline-offset-4"
        >
          APPLICATIONへ戻る
        </a>

        {authState === "checking" || !queryReady ? (
          <div className="mt-6 rounded-2xl bg-white/10 p-4 text-sm text-white/70">
            ログイン状態を確認しています...
          </div>
        ) : authState === "signed_out" ? (
          <div className="mt-6 rounded-2xl bg-white p-5 text-neutral-950">
            <div className="font-bold">受付担当者のログインが必要です</div>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              現在はAPPLICATION主催者だけが受付できます。受付スタッフへの一時権限は後の工程で追加します。
            </p>
            <a
              href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
              className="mt-4 block w-full rounded-full bg-neutral-950 px-5 py-3 text-center text-sm font-bold text-white"
            >
              PARARIにログイン
            </a>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-2xl bg-white p-5 text-neutral-950">
              <div className="text-xs font-bold tracking-[0.14em] text-neutral-400">
                CHECK-IN TARGET
              </div>

              {contextLoading ? (
                <p className="mt-3 text-sm text-neutral-500">
                  受付するAPPLICATIONを確認しています...
                </p>
              ) : application ? (
                <>
                  <div className="mt-2 text-lg font-bold">
                    {application.title}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {application.origin === "calendar"
                      ? "CALENDAR連携APPLICATION"
                      : "APPLICATION"}
                  </div>

                  {application.origin === "calendar" ? (
                    <div className="mt-5">
                      <div className="text-sm font-bold">受付する開催回を選択</div>

                      {occurrences.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {occurrences.map((occurrence) => (
                            <button
                              key={occurrence.id}
                              type="button"
                              onClick={() => {
                                stopCamera();
                                setSelectedOccurrenceId(occurrence.id);
                                setCheckInStartedAt("");
                                setCheckInStartMessage("");
                                setPass(null);
                                setPassCode("");
                                setRawCode("");
                                setMessage("");
                              }}
                              className={[
                                "w-full rounded-xl border px-4 py-3 text-left transition",
                                selectedOccurrenceId === occurrence.id
                                  ? "border-neutral-950 bg-neutral-950 text-white"
                                  : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50",
                              ].join(" ")}
                            >
                              <div className="text-sm font-bold">
                                {formatOccurrenceDate(occurrence)}
                              </div>
                              {occurrence.location ? (
                                <div
                                  className={[
                                    "mt-1 text-xs",
                                    selectedOccurrenceId === occurrence.id
                                      ? "text-white/70"
                                      : "text-neutral-500",
                                  ].join(" ")}
                                >
                                  {occurrence.location}
                                </div>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-neutral-500">
                          受付できる開催回がありません。
                        </p>
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="mt-3 text-sm leading-7 text-neutral-600">
                  {contextMessage ||
                    "運営 → APPLICATION の［QR受付］から受付する募集を選んでください。"}
                </p>
              )}

              {contextMessage && application ? (
                <p className="mt-3 text-sm leading-7 text-rose-700">
                  {contextMessage}
                </p>
              ) : null}
            </div>

            {contextReady && !checkInStartedAt ? (
              <div className="mt-5 rounded-2xl bg-amber-50 p-5 text-neutral-950">
                <div className="text-sm font-bold">入場受付を開始</div>
                <p className="mt-2 text-sm leading-7 text-neutral-700">
                  開始すると、このAPPLICATIONの新規申込と参加者本人によるキャンセルを締め切ります。
                </p>
                <p className="mt-2 text-xs leading-6 text-amber-800">
                  受付開始後は元に戻せません。受付を始める準備ができてから押してください。
                </p>
                <button
                  type="button"
                  disabled={startingCheckIn}
                  onClick={() => void startCheckInMode()}
                  className="mt-4 w-full rounded-full bg-emerald-700 px-5 py-4 text-base font-bold text-white disabled:opacity-40"
                >
                  {startingCheckIn
                    ? "入場受付を開始しています..."
                    : "入場受付を開始する"}
                </button>
              </div>
            ) : null}

            {checkInStartedAt ? (
              <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-neutral-950">
                <div className="text-sm font-bold text-emerald-800">
                  入場受付中
                </div>
                <p className="mt-1 text-xs leading-6 text-emerald-800/80">
                  開始: {formatStartedAt(checkInStartedAt)}
                </p>
                {checkInStartMessage ? (
                  <p className="mt-2 text-xs leading-6 text-emerald-800">
                    {checkInStartMessage}
                  </p>
                ) : null}
              </div>
            ) : null}

            {checkInActive ? (
              <div className="mt-5 rounded-2xl bg-white p-5 text-neutral-950">
                <div className="text-sm font-bold">参加証QRを読み取る</div>
                <p className="mt-1 text-xs leading-6 text-neutral-500">
                  次工程で、このAPPLICATIONの参加者名簿を最初に一括取得してローカル照合する方式へ変更します。今は受付導線の確認段階です。
                </p>

                <div className="mt-4 overflow-hidden rounded-2xl bg-neutral-950">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className={[
                      "aspect-square w-full object-cover",
                      cameraState === "scanning" || cameraState === "starting"
                        ? "block"
                        : "hidden",
                    ].join(" ")}
                  />

                  {cameraState !== "scanning" && cameraState !== "starting" ? (
                    <div className="flex aspect-square items-center justify-center px-6 text-center text-sm leading-7 text-white/60">
                      カメラを起動すると、ここにQR読み取り画面が表示されます。
                    </div>
                  ) : null}
                </div>

                {cameraState === "scanning" ? (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="mt-3 w-full rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-bold text-neutral-800"
                  >
                    カメラを停止
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={cameraState === "starting"}
                    onClick={() => void startCamera()}
                    className="mt-3 w-full rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
                  >
                    {cameraState === "starting"
                      ? "カメラを開始しています..."
                      : "カメラでQRを読む"}
                  </button>
                )}

                <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
                  <div className="h-px flex-1 bg-neutral-200" />
                  または手動入力
                  <div className="h-px flex-1 bg-neutral-200" />
                </div>

                <input
                  value={rawCode}
                  onChange={(event) => {
                    setRawCode(event.target.value);
                    setMessage("");
                  }}
                  placeholder="https://www.parari.app/q/..."
                  className="w-full rounded-xl border border-neutral-300 px-3 py-3 text-sm outline-none focus:border-neutral-700"
                />
                <button
                  type="button"
                  disabled={loading || !rawCode.trim()}
                  onClick={() => void inspectPass()}
                  className="mt-3 w-full rounded-full bg-neutral-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
                >
                  {loading ? "確認しています..." : "参加証を確認"}
                </button>
              </div>
            ) : null}

            {pass ? (
              <div className="mt-5 rounded-2xl bg-white p-5 text-neutral-950">
                <div className="text-xs font-bold text-neutral-400">APPLICATION</div>
                <div className="mt-1 font-bold">{pass.application_title}</div>

                <div className="mt-5 text-xs font-bold text-neutral-400">参加者</div>
                <div className="mt-1 text-2xl font-bold">{pass.participant_name}</div>

                <div className="mt-4 rounded-xl bg-neutral-100 p-3 text-sm font-bold">
                  {pass.checked_in_at
                    ? "受付済み"
                    : pass.status === "confirmed"
                      ? "参加確定・未受付"
                      : "まだ参加確定していません"}
                </div>

                {pass.checked_in_at ? (
                  <p className="mt-4 text-sm leading-7 text-emerald-700">
                    この参加証はすでに受付済みです。
                  </p>
                ) : pass.status === "confirmed" ? (
                  <button
                    type="button"
                    disabled={checkingIn}
                    onClick={() => void checkIn()}
                    className="mt-5 w-full rounded-full bg-emerald-700 px-5 py-4 text-base font-bold text-white disabled:opacity-40"
                  >
                    {checkingIn ? "受付しています..." : "この参加者を受付する"}
                  </button>
                ) : null}
              </div>
            ) : null}

            {message ? (
              <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm leading-7 text-rose-800">
                {message}
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
