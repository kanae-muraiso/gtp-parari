// 2026-10-14 JST / PART: Lazy SDK and serialized disposal prevent overlapping STAGE calls.
import type { DailyCall } from "@daily-co/daily-js";
let disposal: Promise<void> = Promise.resolve();
export function stopLocalStageTracks(call: DailyCall) {
  try {
    const local = call.participants().local;
    if (local) for (const track of Object.values(local.tracks)) {
      track?.persistentTrack?.stop();
      if (track?.track !== track?.persistentTrack) track?.track?.stop();
    }
    call.setLocalAudio(false); call.setLocalVideo(false); call.stopScreenShare();
  } catch { /* A destroyed SDK has already released its devices. */ }
}
export function disposeStageCall(call: DailyCall) {
  stopLocalStageTracks(call);
  // destroy() also leaves the meeting and cleans up listeners/capture, including an in-flight join.
  disposal = disposal.catch(() => {}).then(() => call.destroy());
  void disposal.catch(() => {});
}
export async function createStageCall() {
  await disposal;
  const { default: Daily } = await import("@daily-co/daily-js");
  if (Daily.getCallInstance()) throw new Error("前の接続を終了しています。少し待ってから再接続してください。");
  const browser = Daily.supportedBrowser();
  return { supportsVideoProcessing: !browser.mobile && browser.supportsVideoProcessing,
    call: Daily.createCallObject({ startAudioOff: true, startVideoOff: true, subscribeToTracksAutomatically: false,
      receiveSettings: { base: { video: { layer: 0 } } } }) };
}
