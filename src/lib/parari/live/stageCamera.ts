// 2026-10-14 JST / PART: Apply backgrounds before publishing; never fall back to an unprocessed camera.
import type { DailyCall, DailyInputVideoProcessorSettings } from "@daily-co/daily-js";

export type StageBackground = "blur" | "sand" | "blue" | "none";

async function processorFor(background: StageBackground): Promise<DailyInputVideoProcessorSettings> {
  if (background === "none") return { type: "none" };
  if (background === "blur") return { type: "background-blur", config: { strength: 1 } };
  // Opaque, locally generated PNGs: no image upload or third-party image request.
  const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("背景画像を作成できません。");
  const gradient = context.createLinearGradient(0, 0, 1280, 720);
  gradient.addColorStop(0, background === "sand" ? "#f3eadc" : "#dce9f3");
  gradient.addColorStop(1, background === "sand" ? "#bfa98a" : "#879fbf");
  context.fillStyle = gradient; context.fillRect(0, 0, 1280, 720);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => {
    if (value) resolve(value); else reject(new Error("背景画像を作成できません。"));
  }, "image/png"));
  return { type: "background-image", config: { source: await blob.arrayBuffer() } };
}

export class StageCamera {
  private generation = 0;
  private alive = true;
  private allowed = true;
  private busy = false;
  private expected: DailyInputVideoProcessorSettings["type"] | null = null;
  constructor(private call: DailyCall, readonly supported: boolean,
    private onBusy: (busy: boolean) => void, private onError: (message: string) => void) {
    call.on("nonfatal-error", event => {
      if (event && ["video-processor-error", "input-settings-error"].includes(event.type)) this.fail();
    });
    call.on("input-settings-updated", event => {
      if (this.expected && this.expected !== "none" && event?.inputSettings.video?.processor?.type !== this.expected) this.fail();
    });
    call.on("camera-error", () => this.fail("カメラを停止しました。背景設定と、ブラウザー・OSの機器の許可をご確認ください。"));
  }
  private fail(message = "背景処理を続けられないためカメラを停止しました。背景を選び直してからカメラをONにしてください。") {
    if (!this.alive) return;
    this.disable(); this.onError(message);
  }
  disable() {
    this.generation++; this.expected = null; this.busy = false;
    try { this.call.setLocalVideo(false); } catch {
      // If SDK muting fails, stop only the camera tracks; keep microphone/share independent.
      try {
        const video = this.call.participants().local?.tracks.video;
        video?.persistentTrack?.stop();
        if (video?.track !== video?.persistentTrack) video?.track?.stop();
      } catch { /* An already destroyed call has released its devices. */ }
    }
    this.onBusy(false);
  }
  setAllowed(allowed: boolean) {
    if (this.allowed && !allowed) this.disable();
    this.allowed = allowed;
  }
  close() { this.alive = false; this.disable(); }
  async toggle(background: StageBackground) {
    if (!this.alive || !this.allowed || this.busy) return;
    try { if (this.call.localVideo()) { this.disable(); return; } }
    catch { this.fail(); return; }
    const generation = ++this.generation;
    const current = () => this.alive && this.allowed && generation === this.generation;
    this.busy = true; this.onBusy(true);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      this.call.setLocalVideo(false);
      if (background !== "none" && !this.supported) throw new Error("この端末では背景加工を使えません。カメラOFFで参加するか、背景なしを選んでください。");
      const processor = await processorFor(background);
      if (!current()) return;
      this.expected = processor.type;
      if (this.supported) {
        const result = await Promise.race([
          this.call.updateInputSettings({ video: { processor } }),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("背景の準備に時間がかかっています。再接続してください。")), 20000); }),
        ]);
        if (!current()) return;
        if ((result.inputSettings.video?.processor?.type ?? "none") !== processor.type) throw new Error("背景設定を確認できません。");
      }
      // Closing, host visibility, background changes and SDK errors invalidate pending work.
      if (current()) this.call.setLocalVideo(true);
    } catch {
      if (current()) this.fail("背景を準備できませんでした。カメラはOFFです。背景を選び直すか、STAGEに再接続してください。");
    } finally {
      if (timeout) clearTimeout(timeout);
      if (current()) { this.busy = false; this.onBusy(false); }
    }
  }
}
