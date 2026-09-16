// src/app/checkin/page.tsx
// 2026-09-16 JST
//
// Dedicated APPLICATION check-in mode.
// Ordinary participant QR URLs (/q/:passCode) are read-only.
// Check-in mutations are intentionally exposed only from this dedicated mode.

"use client";

import * as React from "react";

import { supabase } from "@/lib/supabaseClient";

type Occurrence = {
  id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  title: string | null;
  location: string | null;
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

export default function CheckInModePage() {
  const [authState, setAuthState] = React.useState<
    "checking" | "signed_out" | "signed_in"
  >("checking");
  const [accessToken, setAccessToken] = React.useState("");
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

  async function inspectPass(value: string = rawCode) {
    if (!accessToken || loading) {
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

      setPass(result.pass);
    } catch (error) {
      console.error("[CHECK-IN MODE] inspect failed:", error);
      setMessage("参加証を確認できませんでした。");
    } finally {
      setLoading(false);
    }
  }

  async function startCamera() {
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
    if (!accessToken || !pass || !passCode || checkingIn) {
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
        <h1 className="mt-2 text-2xl font-bold">主催者受付モード</h1>
        <p className="mt-3 text-sm leading-7 text-white/70">
          この画面だけが参加者の受付処理を行います。通常の参加証QRをスマホのカメラで開いただけでは受付されません。
        </p>

        {authState === "checking" ? (
          <div className="mt-6 rounded-2xl bg-white/10 p-4 text-sm text-white/70">
            ログイン状態を確認しています...
          </div>
        ) : authState === "signed_out" ? (
          <div className="mt-6 rounded-2xl bg-white p-5 text-neutral-950">
            <div className="font-bold">受付担当者のログインが必要です</div>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              現在はAPPLICATION主催者だけが受付できます。受付スタッフへの一時権限は次の工程で追加します。
            </p>
            <a
              href={`/login?returnTo=${encodeURIComponent("/checkin")}`}
              className="mt-4 block w-full rounded-full bg-neutral-950 px-5 py-3 text-center text-sm font-bold text-white"
            >
              PARARIにログイン
            </a>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-2xl bg-white p-5 text-neutral-950">
              <div className="text-sm font-bold">参加証QRを読み取る</div>
              <p className="mt-1 text-xs leading-6 text-neutral-500">
                CHECK-IN MODEからカメラを起動して参加証QRを読み取ります。読み取っただけでは受付されません。
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
                  {cameraState === "starting" ? "カメラを開始しています..." : "カメラでQRを読む"}
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
